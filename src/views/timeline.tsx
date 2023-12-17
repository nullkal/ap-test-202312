import { User, Post } from "@prisma/client"
import { stripHtml } from "string-strip-html"

import Layout from "./_layout"

interface PostWithAuthor extends Post {
  author: User
}

interface TimelineProps {
  selfUser: User
  selfFolowersCount: number
  selfFollowingCount: number
  posts: PostWithAuthor[]
}

const timeline = (props: TimelineProps) => (
  <Layout title="タイムライン">
    <div style="display: flex; align-items: center;">
      <img
        src="/static/icon.png"
        width="64"
        hegiht="64"
        style=" width: 64px; height: 64px; border: solid 1px #999; flex-shrink: 0;"
      />
      <div style="margin-left: 1em;">
        <p>
          @nullkal
          <br />
          フォロワー: {props.selfFolowersCount} 人, フォロー中:{" "}
          {props.selfFollowingCount} 人
        </p>
      </div>
    </div>

    <form action="/action/follow" method="POST">
      <input type="text" name="targetUser" />
      <button type="submit" name="action" value="follow">
        フォロー
      </button>
      <button type="submit" name="action" value="unfollow">
        フォロー解除
      </button>
    </form>

    <h2>タイムライン</h2>
    <form action="/action/post" method="POST">
      <textarea name="content" style="width: 100%; height: 5em;"></textarea>
      <button type="submit">投稿</button>
    </form>

    {props.posts.map((post) => {
      return (
        <div style="border-bottom: 1px solid #999;">
          <div style="display: flex; align-items: center;">
            <img
              src={post.author.iconUrl}
              width="64"
              hegiht="64"
              style=" width: 64px; height: 64px; border: solid 1px #999; flex-shrink: 0;"
            />
            <div style="margin-left: 1em;">
              {post.author.displayName}
              <br />
              <a href={post.author.actorId}>
                @{post.author.screenName}@{post.author.domain}
              </a>
            </div>
          </div>
          <div style="margin: 0.25em;">{stripHtml(post.content).result}</div>
          <div style="color: #999;">{post.postedAt.toLocaleString()}</div>
        </div>
      )
    })}
  </Layout>
)

export default timeline
