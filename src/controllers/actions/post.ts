import { Hono } from "hono"
import * as env from "../../lib/env"
import { getSelfUser } from "../../lib/get-user"
import prisma from "../../lib/prisma"
import signedFetch from "../../lib/signed-fetch"

const app = new Hono()

app.post("/action/post", async (c) => {
  const selfUser = await getSelfUser()

  const body = await c.req.parseBody()
  const newPost = await prisma.post.create({
    data: {
      author: {
        connect: {
          id: selfUser.id,
        },
      },
      content: body.content as string,
      postedAt: new Date(),
    },
  })

  const followerActorInbox = (
    await prisma.follows.findMany({
      where: {
        followerId: selfUser.id,
      },
      select: {
        following: {
          select: {
            actorInbox: true,
          },
        },
      },
    })
  ).map((follow) => follow.following.actorInbox)

  const createNoteJson = {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      {
        sensitive: "as:sensitive",
      },
    ],
    type: "Create",
    actor: env.userActorUrl,
    published: newPost.postedAt.toISOString(),
    to: ["https://www.w3.org/ns/activitystreams#Public"],
    cc: [`${env.userActorUrl}/followers`],
    object: {
      id: `${env.userActorUrl}/posts/${newPost.id}`,
      type: "Note",
      summary: null,
      inReplyTo: null,
      published: newPost.postedAt.toISOString(),
      url: `${env.userActorUrl}/posts/${newPost.id}`,
      attributedTo: env.userActorUrl,
      to: ["https://www.w3.org/ns/activitystreams#Public"],
      cc: [`${env.userActorUrl}/followers`],
      sensitive: false,
      content: `<p>${newPost.content}</p>`,
    },
  }

  for (const inbox of followerActorInbox) {
    await signedFetch(inbox, {
      method: "POST",
      body: JSON.stringify(createNoteJson),
      headers: {
        "Content-Type": "application/activity+json",
      },
      publicKeyId: `${env.userActorUrl}#main-key`,
      privateKey: env.privateKey,
    })
  }

  return c.redirect("/timeline")
})

export default app
