import { Hono } from "hono"
import * as env from "../lib/env"

const app = new Hono()

app.get("/.well-known/nodeinfo", (c) => {
  return c.json({
    links: [
      {
        rel: "http://nodeinfo.diaspora.software/ns/schema/2.1",
        href: `https://${env.domain}/nodeinfo/2.1`,
      },
    ],
  })
})

app.get("/nodeinfo/2.1", (c) => {
  return c.json({
    openRegistrations: false,
    protocols: ["activitypub"],
    software: {
      name: "ap-test-202312",
      version: "1.0.0",
    },
    usage: {
      users: {
        total: 1,
      },
    },
    services: {
      inbound: [],
      outbound: [],
    },
    metadata: {},
    version: "2.1",
  })
})

export default app
