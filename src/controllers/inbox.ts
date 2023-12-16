import { Context, Hono } from "hono"
import * as env from "../lib/env"
import { getSelfUser, getUserByActorId } from "../lib/get-user"
import * as responses from "../lib/responses"
import prisma from "../lib/prisma"
import signedFetch from "../lib/signed-fetch"
import { User } from "@prisma/client"

const app = new Hono()

app.post(`/users/${env.userName}/inbox`, async (c) => {
  var selfUser = await getSelfUser()

  const body = await c.req.json()
  switch (body["type"]) {
    case "Follow":
      return await processFollowActivity(c, selfUser, body)
    case "Accept":
      return await processAcceptActivity(c, selfUser, body)
    case "Create":
      return await processCreateActivity(c, selfUser, body)
    case "Undo":
      return await processUndoActivity(c, selfUser, body)
    default: {
      // 他のActivityはいったん無視する
      return responses.Success(c)
    }
  }
})

const processFollowActivity = async (c: Context, selfUser: User, body: any) => {
  const actorId = body.actor
  const objectId = body.object

  if (objectId !== env.userActorUrl) {
    return responses.NotFound(c)
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
    id: `${env.userActorUrl}/outbox/1`,
    type: "Accept",
    actor: env.userActorUrl,
    object: body,
  }
  const resp = await signedFetch(actorUser.actorInbox, {
    method: "POST",
    body: JSON.stringify(acceptRequestJson),
    headers: {
      "Content-Type": "application/activity+json",
    },
    publicKeyId: `${env.userActorUrl}#main-key`,
    privateKey: env.privateKey,
  })

  return responses.Success(c)
}

const processAcceptActivity = async (c: Context, selfUser: User, body: any) => {
  const actorId = body.actor
  const object = body.object

  switch (object.type) {
    case "Follow":
      return await processAcceptFollowActivity(c, selfUser, actorId)
    default: {
      return responses.InvalidType(c)
    }
  }
}

const processAcceptFollowActivity = async (
  c: Context,
  selfUser: User,
  actorId: string
) => {
  const objectUser = await prisma.user.findUnique({
    where: {
      actorId,
    },
  })

  if (objectUser === null) {
    return responses.InvalidObject(c)
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

  return responses.Success(c)
}

const processCreateActivity = async (c: Context, selfUser: User, body: any) => {
  const actorId = body.actor
  const object = body.object

  switch (object.type) {
    case "Note":
      return await processCreateNoteActivity(c, selfUser, body, object, actorId)
    default: {
      return responses.InvalidType(c)
    }
  }
}

const processCreateNoteActivity = async (
  c: Context,
  selfUser: User,
  body: any,
  object: any,
  actorId: string
) => {
  const actorUser = await prisma.user.findUnique({
    where: {
      actorId,
    },
  })

  if (actorUser === null) {
    return responses.InvalidObject(c)
  }

  // ユーザーは一人しか居ないので、inboxに送られてきた投稿は全て自分の投稿として処理する
  // ちゃんと実装するときは、toとかccとかを見て送信先ユーザーを振り分けてね
  await prisma.post.create({
    data: {
      content: object.content,
      authorId: actorUser.id,
      postedAt: new Date(object.published),
    },
  })

  return responses.Success(c)
}

const processUndoActivity = async (c: Context, selfUser: User, body: any) => {
  const actorId = body.actor
  const object = body.object

  switch (object.type) {
    case "Follow":
      return await processUndoFollowActivity(c, selfUser, actorId)
    default: {
      // 握りつぶす (投稿削除とかも来るのでちゃんと処理してね)
      return responses.Success(c)
    }
  }
}

const processUndoFollowActivity = async (
  c: Context,
  selfUser: User,
  actorId: string
) => {
  const objectUser = await prisma.user.findUnique({
    where: {
      actorId,
    },
  })

  if (objectUser === null) {
    return responses.InvalidObject(c)
  }

  await prisma.follows.delete({
    where: {
      followerId_followingId: {
        followerId: selfUser.id,
        followingId: objectUser.id,
      },
    },
  })

  return responses.Success(c)
}

export default app
