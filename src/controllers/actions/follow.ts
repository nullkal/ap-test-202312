import { Context, Hono } from "hono"
import { getSelfUser, getUserByActorId } from "../../lib/get-user"
import * as env from "../../lib/env"
import prisma from "../../lib/prisma"
import signedFetch from "../../lib/signed-fetch"
import errorView from "../../views/error"
import { User } from "@prisma/client"

const app = new Hono()

app.post("/action/follow", async (c) => {
  const selfUser = await getSelfUser()

  const body = await c.req.parseBody()
  if (!body.targetUser) {
    return c.html(errorView("ターゲットユーザーが指定されていません。"))
  }

  const parsedUserName = (body.targetUser as string).match(/@(.*)@(.*)/)
  if (!parsedUserName) {
    return c.html(errorView("ターゲットユーザー名がおかしいです。"))
  }

  const [, targetUserScreenName, targetUserDomain] = parsedUserName
  const webFingerResponse = await fetch(
    `https://${targetUserDomain}/.well-known/webfinger?resource=acct:${targetUserScreenName}@${targetUserDomain}`
  )

  if (!webFingerResponse.ok) {
    return c.html(
      errorView("ターゲットユーザーをWebFingerで見つけられませんでした。")
    )
  }

  // anyいっぱいごめんね……
  const webFingerResponseJson = (await webFingerResponse.json()) as any
  const targetActorId = (webFingerResponseJson.links as any[]).find(
    (link: any) =>
      link.rel === "self" && link.type === "application/activity+json"
  ).href

  const targetUser = await getUserByActorId(targetActorId)
  if (targetUser === null) {
    return c.html(
      errorView("ターゲットユーザーのActorが取得できませんでした。")
    )
  }

  switch (body.action) {
    case "follow":
      return await followAction(c, targetUser)
    case "unfollow":
      return await unfollowAction(c, selfUser, targetUser)
    default:
      return c.html(errorView("不正なアクションです。"))
  }
})

const followAction = async (c: Context, targetUser: User) => {
  const resp = await signedFetch(targetUser.actorInbox, {
    method: "POST",
    body: JSON.stringify({
      "@context": "https://www.w3.org/ns/activitystreams",
      id: `${env.userActorUrl}}/outbox/1`,
      type: "Follow",
      actor: env.userActorUrl,
      object: targetUser.actorId,
    }),
    headers: {
      "Content-Type": "application/activity+json",
    },
    publicKeyId: `${env.userActorUrl}#main-key`,
    privateKey: env.privateKey,
  })

  if (!resp.ok) {
    return c.html(errorView("フォローに失敗しました。"))
  }

  // ※Acceptアクティビティが帰ってきてからDBに保存するので、ここではDBに保存しない

  return c.redirect("/timeline")
}

const unfollowAction = async (c: Context, selfUser: User, targetUser: User) => {
  const resp = await signedFetch(targetUser.actorInbox, {
    method: "POST",
    body: JSON.stringify({
      "@context": "https://www.w3.org/ns/activitystreams",
      id: `${env.userActorUrl}/outbox/1`,
      type: "Undo",
      actor: env.userActorUrl,
      object: {
        id: `${env.userActorUrl}/outbox/1`,
        type: "Follow",
        actor: env.userActorUrl,
        object: targetUser.actorId,
      },
    }),
    headers: {
      "Content-Type": "application/activity+json",
    },
    publicKeyId: `${env.userActorUrl}#main-key`,
    privateKey: env.privateKey,
  })

  if (!resp.ok) {
    return c.html(errorView("フォロー解除に失敗しました。"))
  }

  await prisma.follows.delete({
    where: {
      followerId_followingId: {
        followerId: targetUser.id,
        followingId: selfUser.id,
      },
    },
  })

  return c.redirect("/timeline")
}

export default app
