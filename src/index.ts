import 'dotenv/config'

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { html, raw } from 'hono/html'
import * as fs from 'fs'

const USERNAME = process.env.USERNAME || 'nullkal'
const DOMAIN = process.env.DOMAIN || 'localhost'

const PUBLIC_KEY = fs.readFileSync('./data/public.pem', 'utf8')
const PRIVATE_KEY = fs.readFileSync('./data/private.pem', 'utf8')

const app = new Hono()
app.use('/static/*', serveStatic({ root: './' }))

app.get('/', (c) => {
  return c.html(html`
    <!DOCTYPE html>
    <html>
      <head>
        <title>An experimental implementation of ActivityPub (2023/12)</title>
      </head>

      <body>
        <h1>ActivityPubの実験実装 (2023/12版)</h1>
        <p>このサイトはActivityPubの実験実装です。</p>
        <p>実装者: <a href="https://social.nil.nu/@nullkal">@nullkal</a></p>
      </body>
    </html>
  `)
})

app.get('/.well-known/nodeinfo', (c) => {
  return c.json({
    links: [
      {
        rel: 'http://nodeinfo.diaspora.software/ns/schema/2.1',
        href: `https://${DOMAIN}/nodeinfo/2.1`
      },
    ],
  })
})

app.get('/nodeinfo/2.1', (c) => {
  return c.json({
    "openRegistrations": false,
    "protocols": [
        "activitypub"
    ],
    "software": {
        "name": "ap-test-202312",
        "version": "1.0.0"
    },
    "usage": {
        "users": {
            "total": 1
        }
    },
    "services": {
        "inbound": [],
        "outbound": []
    },
    "metadata": {},
    "version": "2.1"
  })
})

app.get('/.well-known/webfinger', (c) => {
  const resource = c.req.query('resource')
  if (resource !== `acct:${USERNAME}@${DOMAIN}`) {
    return c.json({
      error: 'not_found',
    }, 404)
  }

  return c.json({
    "subject": `acct:${USERNAME}@${DOMAIN}`,
    "aliases": [
      `https://${DOMAIN}/@${USERNAME}`,
      `https://${DOMAIN}/users/${USERNAME}`,
    ],
    "links": [
      {
        "rel": "self",
        "type": "application/activity+json",
        "href": `https://${DOMAIN}/users/${USERNAME}`,
      },
    ],
  })
})

app.get(`/@${USERNAME}`, (c) => {
  // TODO: ユーザーのプロフィールページを表示する
  return c.redirect(`https://${DOMAIN}/`)
})

app.get(`/users/${USERNAME}`, (c) => {
  if (c.req.header('Accept') !== 'application/activity+json') {
    return c.redirect(`https://${DOMAIN}/@${USERNAME}`)
  }

  return c.json({
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/v1",
      {
        "manuallyApprovesFollowers": "as:manuallyApprovesFollowers",
      }
    ],
    "id": `https://${DOMAIN}/users/${USERNAME}`,
    "type": "Person",
    "following": `https://${DOMAIN}/users/nullkal/following`,
    "followers": `https://${DOMAIN}/users/nullkal/followers`,
    "inbox": `https://${DOMAIN}/users/nullkal/inbox`,
    "outbox": `https://${DOMAIN}/users/nullkal/outbox`,
    "preferredUsername": `${USERNAME}`,
    "name": "カル (ActivityPub 実験中)",
    "summary": "ActivityPubの実験実装を試しています。",
    "url": `https://${DOMAIN}/@${USERNAME}`,
    "manuallyApprovesFollowers": false,
    "publicKey": {
      "id": "https://${DOMAIN}/users/${USERNAME}#main-key",
      "owner": "https://${DOMAIN}/users/${USERNAME}",
      "publicKeyPem": PUBLIC_KEY,
    },
    "icon": {
        "type": "Image",
        "mediaType": "image/png",
        "url": `https://${DOMAIN}/static/icon.png`,
    },
  })
})

serve(app)
