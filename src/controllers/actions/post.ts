import { Hono } from "hono"
import { getSelfUser } from "../../lib/get-user"
import prisma from "../../lib/prisma"

const app = new Hono()

export default app
