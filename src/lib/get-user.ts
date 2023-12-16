import { assert } from "console"

import prisma from "./prisma"
import * as env from "./env"

/**
 * 自分のユーザー情報を取得します。
 * @returns 自分のユーザー情報
 */
export const getSelfUser = async () => {
  const selfUser = await prisma.user.findUnique({
    where: {
      domain_screenName: { domain: env.domain, screenName: env.userName },
    },
    include: {
      _count: {
        select: {
          followers: true,
          following: true,
        },
      },
    },
  })
  assert(selfUser !== null)
  return selfUser!
}

/**
 * Actor ID からユーザー情報を取得します。
 * 自分以外は全員リモートユーザーなので、HTTPでActor情報を取得してDBに保存します。
 * @param actorId 取得するユーザーのActor ID
 * @returns
 */
export const getUserByActorId = async (actorId: string) => {
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
    update: {
      inbox: actor.inbox,
      displayName: actor.name,
      iconUrl: actor.icon.url,
      publicKey: actor.publicKey.publicKeyPem,
      actorId,
      actorInbox: actor.inbox,
    },
  })

  return actorUser
}
