import "dotenv/config"

import { serve } from "@hono/node-server"
import { Context, Hono } from "hono"
import { serveStatic } from "@hono/node-server/serve-static"
import { basicAuth } from "hono/basic-auth"
import { logger } from "hono/logger"
import fetch from "node-fetch"
import * as fs from "fs"
import { PrismaClient, User } from "@prisma/client"
import { assert } from "console"
import { Sha256Signer } from "activitypub-http-signatures"
import * as crypto from "crypto"

const USERNAME = process.env.USERNAME || "nullkal"
const DOMAIN = process.env.DOMAIN || "localhost"

const PUBLIC_KEY = fs.readFileSync("./data/public.pem", "utf8")
const PRIVATE_KEY = fs.readFileSync("./data/private.pem", "utf8")

const app = new Hono()
const prisma = new PrismaClient()

app.use("*", logger())
app.use("/static/*", serveStatic({ root: "./" }))

const auth = basicAuth({
  username: USERNAME,
  password: process.env.PASSWORD || "password",
})
app.use("/timeline", auth)
app.use("/action", auth)

const getSelfUser = async () => {
  const selfUser = await prisma.user.findUnique({
    where: { domain_screenName: { domain: DOMAIN, screenName: USERNAME } },
  })
  assert(selfUser !== null)
  return selfUser!
}

const signedFetch = async (url: string, options: any) => {
  const digest = options.body
    ? `SHA-256=${crypto
        .createHash("sha256")
        .update(options.body)
        .digest("base64")}`
    : null
  const headerNames = [
    "(request-target)",
    "host",
    "date",
    ...(digest ? ["digest"] : []),
  ]

  const headers = {
    host: new URL(url).host,
    date: new Date().toUTCString(),
    digest,
    ...options.headers,
  }

  const method = options.method || "GET"
  const signer = new Sha256Signer({
    publicKeyId: `https://${DOMAIN}/users/${USERNAME}#main-key`,
    privateKey: PRIVATE_KEY,
    headerNames,
  })

  const signature = signer.sign({ url, method, headers })

  return await fetch(url, {
    ...options,
    headers: {
      ...headers,
      signature,
      accept: "application/ld+json",
    },
  })
}

app.get("/", (c) => {
  return c.html(
    <html>
      <head>
        <title>An experimental implementation of ActivityPub (2023/12)</title>
      </head>

      <body>
        <h1>ActivityPubの実験実装 (2023/12版)</h1>
        <p>このサイトはActivityPubの実験実装です。</p>
        <p>
          実装者: <a href="https://social.nil.nu/@nullkal">@nullkal</a>
        </p>
      </body>
    </html>
  )
})

app.get("/.well-known/nodeinfo", (c) => {
  return c.json({
    links: [
      {
        rel: "http://nodeinfo.diaspora.software/ns/schema/2.1",
        href: `https://${DOMAIN}/nodeinfo/2.1`,
      },
    ],
  })
})

app.get("/nodeinfo/2.1", (c) => {
  return c.json({
    openRegistrations: false,
    protocols: ["activitypub"],
    software: {
      name: "ap-test-202312",
      version: "1.0.0",
    },
    usage: {
      users: {
        total: 1,
      },
    },
    services: {
      inbound: [],
      outbound: [],
    },
    metadata: {},
    version: "2.1",
  })
})

app.get("/.well-known/webfinger", (c) => {
  const resource = c.req.query("resource")
  if (resource !== `acct:${USERNAME}@${DOMAIN}`) {
    return c.json(
      {
        error: "not_found",
      },
      404
    )
  }

  return c.json({
    subject: `acct:${USERNAME}@${DOMAIN}`,
    aliases: [
      `https://${DOMAIN}/@${USERNAME}`,
      `https://${DOMAIN}/users/${USERNAME}`,
    ],
    links: [
      {
        rel: "self",
        type: "application/activity+json",
        href: `https://${DOMAIN}/users/${USERNAME}`,
      },
    ],
  })
})

var getUserAction = (c: Context) => {
  if (!c.req.header("accept")?.includes("application/activity+json")) {
    return c.redirect(`https://${DOMAIN}/`)
  }

  return c.json({
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/v1",
      {
        manuallyApprovesFollowers: "as:manuallyApprovesFollowers",
      },
    ],
    id: `https://${DOMAIN}/users/${USERNAME}`,
    type: "Person",
    following: `https://${DOMAIN}/users/${USERNAME}/following`,
    followers: `https://${DOMAIN}/users/${USERNAME}/followers`,
    inbox: `https://${DOMAIN}/users/${USERNAME}/inbox`,
    outbox: `https://${DOMAIN}/users/${USERNAME}/outbox`,
    preferredUsername: `${USERNAME}`,
    name: "カル (ActivityPub 実験中)",
    summary: "ActivityPubの実験実装を試しています。",
    url: `https://${DOMAIN}/@${USERNAME}`,
    manuallyApprovesFollowers: false,
    discoverable: true,
    indexable: true,
    published: "2023-12-03T22:34:01+09:00",
    memorial: false,
    publicKey: {
      id: `https://${DOMAIN}/users/${USERNAME}#main-key`,
      owner: `https://${DOMAIN}/users/${USERNAME}`,
      publicKeyPem: PUBLIC_KEY,
    },
    icon: {
      type: "Image",
      mediaType: "image/png",
      url: `https://${DOMAIN}/static/icon.png`,
    },
  })
}

app.get(`/@${USERNAME}`, getUserAction)
app.get(`/users/${USERNAME}`, getUserAction)

const getUserByActorId = async (actorId: string) => {
  const actorDomain = new URL(actorId).host

  const actor: any = await (
    await fetch(actorId, {
      headers: { Accept: "application/activity+json" },
    })
  ).json()

  const actorUser = await prisma.user.upsert({
    where: {
      domain_screenName: {
        domain: actorDomain,
        screenName: actor.preferredUsername,
      },
    },
    create: {
      screenName: actor.preferredUsername,
      domain: actorDomain,
      inbox: actor.inbox,
      displayName: actor.name,
      iconUrl: actor.icon.url,
      publicKey: actor.publicKey.publicKeyPem,
      actorId,
      actorInbox: actor.inbox,
    },
    update: {},
  })

  return actorUser
}

app.post(`/users/${USERNAME}/inbox`, async (c) => {
  var selfUser = await getSelfUser()

  const body = await c.req.json()
  switch (body["type"]) {
    case "Follow": {
      const actorId = body.actor
      const objectId = body.object

      if (objectId !== `https://${DOMAIN}/users/${USERNAME}`) {
        return c.json(
          {
            error: "invalid_object",
          },
          400
        )
      }

      // (注意！) 送信元のユーザーの正当性を確認していない危険な実装になっているので、
      // ちゃんと実装するときにはHTTP Signatureを使って送信元のユーザーを確認してください。

      const actorUser = await getUserByActorId(actorId)

      await prisma.follows.upsert({
        where: {
          followerId_followingId: {
            followerId: selfUser.id,
            followingId: actorUser.id,
          },
        },
        create: {
          followerId: selfUser.id,
          followingId: actorUser.id,
        },
        update: {},
      })

      const acceptRequestJson = {
        "@context": "https://www.w3.org/ns/activitystreams",
        id: `https://${DOMAIN}/users/${USERNAME}/outbox/1`,
        type: "Accept",
        actor: `https://${DOMAIN}/users/${USERNAME}`,
        object: body,
      }
      const resp = await signedFetch(actorUser.actorInbox, {
        method: "POST",
        body: JSON.stringify(acceptRequestJson),
        headers: {
          "Content-Type": "application/activity+json",
        },
      })

      return c.json({})
    }
    case "Accept": {
      const actorId = body.actor
      const object = body.object

      switch (object.type) {
        case "Follow": {
          const objectUser = await prisma.user.findUnique({
            where: {
              actorId,
            },
          })

          if (objectUser === null) {
            return c.json(
              {
                error: "invalid_object",
              },
              400
            )
          }

          await prisma.follows.upsert({
            where: {
              followerId_followingId: {
                followerId: objectUser.id,
                followingId: selfUser.id,
              },
            },
            create: {
              followerId: objectUser.id,
              followingId: selfUser.id,
            },
            update: {},
          })

          return c.json({})
        }
        default: {
          return c.json(
            {
              error: "invalid_type",
            },
            400
          )
        }
      }
    }
    case "Undo": {
      const actorId = body.actor
      const object = body.object

      switch (object.type) {
        case "Follow": {
          const objectUser = await prisma.user.findUnique({
            where: {
              actorId,
            },
          })

          if (objectUser === null) {
            return c.json(
              {
                error: "invalid_object",
              },
              400
            )
          }

          await prisma.follows.delete({
            where: {
              followerId_followingId: {
                followerId: selfUser.id,
                followingId: objectUser.id,
              },
            },
          })

          return c.json({})
        }
        default: {
          return c.json(
            {
              error: "invalid_type",
            },
            400
          )
        }
      }
    }
    default: {
      // TODO: フォロー解除を処理する, こっちからフォローしたののAcceptを処理する

      return c.json(
        {
          error: "invalid_type",
        },
        400
      )
    }
  }
})

app.post("/action/follow", async (c) => {
  const selfUser = await getSelfUser()

  const body = await c.req.parseBody()
  if (!body.targetUser) {
    return c.json(
      {
        error: "invalid_target_user",
      },
      400
    )
  }

  const parsedUserName = (body.targetUser as string).match(/@(.*)@(.*)/)
  if (!parsedUserName) {
    return c.json(
      {
        error: "invalid_target_user",
      },
      400
    )
  }

  const [, targetUserScreenName, targetUserDomain] = parsedUserName
  const webfingerResp = (await (
    await fetch(
      `https://${targetUserDomain}/.well-known/webfinger?resource=acct:${targetUserScreenName}@${targetUserDomain}`
    )
  ).json()) as any

  const targetActorId = (webfingerResp.links as any[]).find(
    (link: any) =>
      link.rel === "self" && link.type === "application/activity+json"
  ).href

  const targetUser = await getUserByActorId(targetActorId)
  if (targetUser === null) {
    return c.json(
      {
        error: "invalid_target_user",
      },
      400
    )
  }

  switch (body.action) {
    case "follow": {
      signedFetch(targetUser.actorInbox, {
        method: "POST",
        body: JSON.stringify({
          "@context": "https://www.w3.org/ns/activitystreams",
          id: `https://${DOMAIN}/users/${USERNAME}/outbox/1`,
          type: "Follow",
          actor: `https://${DOMAIN}/users/${USERNAME}`,
          object: targetActorId,
        }),
        headers: {
          "Content-Type": "application/activity+json",
        },
      })
      return c.json({})
    }
    case "unfollow": {
      signedFetch(targetUser.actorInbox, {
        method: "POST",
        body: JSON.stringify({
          "@context": "https://www.w3.org/ns/activitystreams",
          id: `https://${DOMAIN}/users/${USERNAME}/outbox/1`,
          type: "Undo",
          actor: `https://${DOMAIN}/users/${USERNAME}`,
          object: {
            id: `https://${DOMAIN}/users/${USERNAME}/outbox/1`,
            type: "Follow",
            actor: `https://${DOMAIN}/users/${USERNAME}`,
            object: targetActorId,
          },
        }),
        headers: {
          "Content-Type": "application/activity+json",
        },
      })

      await prisma.follows.delete({
        where: {
          followerId_followingId: {
            followerId: targetUser.id,
            followingId: selfUser.id,
          },
        },
      })

      return c.json({})
    }
    default: {
      return c.json(
        {
          error: "invalid_action",
        },
        400
      )
    }
  }
})

app.get("/timeline", async (c) => {
  var selfUser = await getSelfUser()

  return c.html(
    <html>
      <head>
        <title>
          Timeline: An experimental implementation of ActivityPub (2023/12)
        </title>
      </head>

      <body>
        <div style="display: flex; align-items: center;">
          <img
            src="/static/icon.png"
            width="64"
            hegiht="64"
            style=" width: 64px; height: 64px; border: solid 1px #999; flex-shrink: 0;"
          />
          <div>
            <p>
              @nullkal
              <br />
              フォロワー:
              {await prisma.follows.count({
                where: { followerId: selfUser.id },
              })}
              人 , フォロー中:
              {await prisma.follows.count({
                where: { followingId: selfUser.id },
              })}
              人
            </p>
          </div>
        </div>

        <form action="/action/follow" method="POST">
          <input type="text" name="targetUser" />
          <button type="submit" name="action" value="follow">
            フォロー
          </button>
          <button type="submit" name="action" value="unfollow">
            フォロー解除
          </button>
        </form>

        <h2>タイムライン</h2>
        <p>TODO: ユーザーのタイムラインを表示する</p>
      </body>
    </html>
  )
})

serve(app)
