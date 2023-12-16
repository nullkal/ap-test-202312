import { Hono } from "hono"
import { getSelfUser } from "../lib/get-user"
import prisma from "../lib/prisma"
import indexView from "../views/index"
import timelineView from "../views/timeline"

const app = new Hono()

app.get("/", (c) => {
  return c.html(indexView())
})

app.get("/timeline", async (c) => {
  var selfUser = await getSelfUser()

  return c.html(
    timelineView({
      selfUser,
      selfFolowersCount: selfUser._count.followers,
      selfFollowingCount: selfUser._count.following,
      posts: await prisma.post.findMany({
        orderBy: { postedAt: "desc" },
        take: 20,
        include: { author: true },
      }),
    })
  )
})

export default app
