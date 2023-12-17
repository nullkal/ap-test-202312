import { Hono } from "hono"
import { createFactory } from "hono/factory"
import * as env from "../lib/env"
import * as responses from "../lib/responses"
import prisma from "../lib/prisma"
import { getSelfUser } from "../lib/get-user"

const app = new Hono()

app.get("/.well-known/webfinger", (c) => {
  const resource = c.req.query("resource")
  if (resource !== `acct:${env.fullUserName}`) {
    return responses.NotFound(c)
  }

  return c.json({
    subject: `acct:${env.fullUserName}`,
    aliases: [env.userUrl, env.userActorUrl],
    links: [
      {
        rel: "self",
        type: "application/activity+json",
        href: env.userActorUrl,
      },
    ],
  })
})

const factory = createFactory()
const userHandlers = factory.createHandlers((c) => {
  if (!c.req.header("accept")?.includes("application/activity+json")) {
    return c.redirect(`https://${env.domain}/`)
  }

  if (c.req.param("userName") !== env.userName) {
    return responses.NotFound(c)
  }

  return c.json({
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/v1",
      {
        manuallyApprovesFollowers: "as:manuallyApprovesFollowers",
      },
    ],
    id: env.userActorUrl,
    type: "Person",
    following: `${env.userActorUrl}/following`,
    followers: `${env.userActorUrl}/followers`,
    inbox: `${env.userActorUrl}/inbox`,
    outbox: `${env.userActorUrl}/outbox`,
    preferredUsername: `${env.userName}`,
    name: "カル (ActivityPub 実験中)",
    summary: "ActivityPubの実験実装を試しています。",
    url: env.userActorUrl,
    manuallyApprovesFollowers: false,
    discoverable: true,
    indexable: true,
    published: "2023-12-03T22:34:01+09:00",
    memorial: false,
    publicKey: {
      id: `${env.userActorUrl}#main-key`,
      owner: env.userActorUrl,
      publicKeyPem: env.publicKey,
    },
    icon: {
      type: "Image",
      mediaType: "image/png",
      url: `https://${env.domain}/static/icon.png`,
    },
  })
})

app.get(`/@:userName`, ...userHandlers)
app.get(`/users/:userName`, ...userHandlers)

app.get(`/users/:userName/followers`, async (c) => {
  if (!c.req.header("accept")?.includes("application/activity+json")) {
    return c.redirect(`https://${env.domain}/`)
  }

  if (c.req.param("userName") !== env.userName) {
    return responses.NotFound(c)
  }

  return c.json({
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${env.userActorUrl}/followers`,
    type: "OrderedCollection",
    totalItems: 0,
    orderedItems: [],
  })
})

app.get(`/users/:userName/following`, async (c) => {
  if (!c.req.header("accept")?.includes("application/activity+json")) {
    return c.redirect(`https://${env.domain}/`)
  }

  if (c.req.param("userName") !== env.userName) {
    return responses.NotFound(c)
  }

  return c.json({
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${env.userActorUrl}/following`,
    type: "OrderedCollection",
    totalItems: 0,
    orderedItems: [],
  })
})

app.get(`/users/:userName/outbox`, async (c) => {
  const selfUser = await getSelfUser()

  if (!c.req.header("accept")?.includes("application/activity+json")) {
    return c.redirect(`https://${env.domain}/`)
  }

  if (c.req.param("userName") !== env.userName) {
    return responses.NotFound(c)
  }

  const posts = await prisma.post.findMany({
    where: {
      authorId: selfUser.id,
    },
    orderBy: {
      postedAt: "desc",
    },
  })

  return c.json({
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      {
        sensitive: "as:sensitive",
      },
    ],
    id: `${env.userActorUrl}/outbox`,
    type: "OrderedCollection",
    totalItems: posts.length,
    orderedItems: posts.map((post) => ({
      id: `${env.userActorUrl}/posts/${post.id}`,
      type: "Note",
      summary: null,
      inReplyTo: null,
      published: post.postedAt.toISOString(),
      url: `${env.userActorUrl}/posts/${post.id}`,
      attributedTo: env.userActorUrl,
      to: ["https://www.w3.org/ns/activitystreams#Public"],
      cc: [`${env.userActorUrl}/followers`],
      sensitive: false,
      content: `<p>${post.content}</p>`,
    })),
  })
})

export default app
