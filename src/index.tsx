import 'dotenv/config'

import { serve } from '@hono/node-server'
import { Context, Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { basicAuth } from 'hono/basic-auth'
import { logger } from 'hono/logger'
import ky from 'ky'
import * as fs from 'fs'

const USERNAME = process.env.USERNAME || 'nullkal'
const DOMAIN = process.env.DOMAIN || 'localhost'

const PUBLIC_KEY = fs.readFileSync('./data/public.pem', 'utf8')
const PRIVATE_KEY = fs.readFileSync('./data/private.pem', 'utf8')

const app = new Hono()

app.use('*', logger())
app.use('/static/*', serveStatic({ root: './' }))

const auth = basicAuth({
  username: USERNAME,
  password: process.env.PASSWORD || 'password',
})
app.use('/timeline', auth)
app.use('/action', auth)

app.get('/', (c) => {
  return c.html(
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
  )
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

var getUserAction = (c: Context) => {
  if (!c.req.header('accept')?.includes('application/activity+json')) {
    return c.redirect(`https://${DOMAIN}/`)
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
    "following": `https://${DOMAIN}/users/${USERNAME}/following`,
    "followers": `https://${DOMAIN}/users/${USERNAME}/followers`,
    "inbox": `https://${DOMAIN}/users/${USERNAME}/inbox`,
    "outbox": `https://${DOMAIN}/users/${USERNAME}/outbox`,
    "preferredUsername": `${USERNAME}`,
    "name": "カル (ActivityPub 実験中)",
    "summary": "ActivityPubの実験実装を試しています。",
    "url": `https://${DOMAIN}/@${USERNAME}`,
    "manuallyApprovesFollowers": false,
    "discoverable": true,
    "indexable": true,
    "published": "2023-12-03T22:34:01+09:00",
    "memorial": false,
    "publicKey": {
      "id": `https://${DOMAIN}/users/${USERNAME}#main-key`,
      "owner": `https://${DOMAIN}/users/${USERNAME}`,
      "publicKeyPem": PUBLIC_KEY,
    },
    "icon": {
        "type": "Image",
        "mediaType": "image/png",
        "url": `https://${DOMAIN}/static/icon.png`,
    },
  })
}

app.get(`/@${USERNAME}`, getUserAction)
app.get(`/users/${USERNAME}`, getUserAction)

app.post(`/users/${USERNAME}/inbox`, async (c) => {
  const body = await c.req.json()
  switch (body.type) {
    case 'Follow': {
      const follow = body as {
        type: 'Follow',
        actor: string,
        object: string,
      }

      if (follow.object !== `https://${DOMAIN}/users/${USERNAME}`) {
        return c.json({
          error: 'invalid_object',
        }, 400)
      }

      // (注意！) 送信元のユーザーの正当性を確認していない危険な実装になっているので、
      // ちゃんと実装するときにはHTTP Signatureを使って送信元のユーザーを確認してください。

      //TODO: フォローをDBに保存する

      return c.json({
        type: 'Accept',
        actor: `https://${DOMAIN}/users/${USERNAME}`,
        object: follow,
      })
    }
    default: {
      return c.json({
        error: 'invalid_type',
      }, 400)
    }
  }
})

app.post('/action/follow', async (c) => {
  const body = await c.req.parseBody()
  switch (body.action) {
    case 'follow': {
      return c.json({})
    }
    case 'unfollow': {
      return c.json({})
    }
    default: {
      return c.json({
        error: 'invalid_action',
      }, 400)
    }
  }
})

app.get('/timeline', (c) => {
  return c.html(<html>
    <head>
      <title>Timeline: An experimental implementation of ActivityPub (2023/12)</title>
    </head>

    <body>
      <form action="/action/follow" method="POST">
        <input type="text" name="user" />
        <button type="submit" name="action" value="follow">フォロー</button>
        <button type="submit" name="action" value="unfollow">フォロー解除</button>
      </form>

      <h2>タイムライン</h2>
      <p>TODO: ユーザーのタイムラインを表示する</p>
    </body>
  </html>)
})

serve(app)
