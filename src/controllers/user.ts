import { Hono } from "hono"
import { createFactory } from "hono/factory"
import * as env from "../lib/env"
import * as responses from "../lib/responses"

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

export default app
