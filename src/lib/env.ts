import "dotenv/config"
import * as fs from "fs"

const requiredEnv = ["USERNAME", "PASSWORD", "DOMAIN"]
for (const env of requiredEnv) {
  if (!process.env[env]) {
    console.error(`ERROR: 環境変数 ${env} が設定されていません`)
    process.exit(1)
  }
}

export const userName = process.env.USERNAME!
export const password = process.env.PASSWORD!
export const domain = process.env.DOMAIN!

export const publicKey = fs.readFileSync("./data/public.pem", "utf8")
export const privateKey = fs.readFileSync("./data/private.pem", "utf8")

export const fullUserName = `${domain}@${userName}`
export const userUrl = `https://${domain}/@${userName}`
export const userActorUrl = `https://${domain}/users/${userName}`
