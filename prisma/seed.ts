import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as env from "../src/lib/env"

const PUBLIC_KEY = fs.readFileSync("./data/public.pem", "utf8")

const prisma = new PrismaClient()
async function main() {
  const selfUser = await prisma.user.upsert({
    where: {
      domain_screenName: { domain: env.domain, screenName: env.userName },
    },
    update: {},
    create: {
      screenName: env.userName,
      domain: env.domain,
      inbox: `${env.userActorUrl}/inbox`,
      displayName: env.userName,
      iconUrl: `https://${env.domain}/static/icon.png`,
      publicKey: PUBLIC_KEY,
      actorId: env.userActorUrl,
      actorInbox: `${env.userActorUrl}/inbox`,
    },
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
