import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { serveStatic } from "@hono/node-server/serve-static"
import { basicAuth } from "hono/basic-auth"
import { logger } from "hono/logger"
import * as env from "./lib/env"

const app = new Hono()

app.use("*", logger())
app.use("/static/*", serveStatic({ root: "./" }))

const auth = basicAuth({
  username: env.userName,
  password: env.password,
})
app.use("/timeline", auth)
app.use("/action/*", auth)

import indexController from "./controllers/index"
import inboxController from "./controllers/inbox"
import nodeInfoController from "./controllers/node-info"
import userController from "./controllers/user"
import followActionController from "./controllers/actions/follow"
import postActionController from "./controllers/actions/post"

app.route("/", indexController)
app.route("/", nodeInfoController)
app.route("/", userController)
app.route("/", inboxController)
app.route("/", followActionController)
app.route("/", postActionController)

serve(app)
