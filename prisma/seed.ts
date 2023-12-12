import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const USERNAME = process.env.USERNAME || 'nullkal'
const DOMAIN = process.env.DOMAIN || 'localhost'

const PUBLIC_KEY = fs.readFileSync('./data/public.pem', 'utf8')

const prisma = new PrismaClient()
async function main() {
  const selfUser = await prisma.user.upsert({
    where: { domain_screenName: { domain: DOMAIN, screenName: USERNAME } },
    update: {},
    create: {
      screenName: USERNAME,
      domain: DOMAIN,
      inbox: `https://${DOMAIN}/users/${USERNAME}/inbox`,
      displayName: USERNAME,
      iconUrl: `https://${DOMAIN}/static/icon.png`,
      publicKey: PUBLIC_KEY,
      actorId: `https://${DOMAIN}/users/${USERNAME}`,
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
