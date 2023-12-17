import { Child } from "hono/jsx"

interface LayoutProps {
  children: Child[]
  title?: string
}

const layout = (props: LayoutProps) => (
  <html>
    <head>
      <title>
        {props.title ? `${props.title} - ` : ""}An experimental implementation
        of ActivityPub (2023/12)
      </title>
      <link
        rel="stylesheet"
        href="https://unpkg.com/normalize.css@8.0.1/normalize.css"
      />
    </head>

    <body>
      <div style="width: 100%; max-width: 1024px; margin: 2em auto;">
        {props.children}
      </div>
    </body>
  </html>
)

export default layout
