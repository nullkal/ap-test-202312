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
    </head>

    <body>{props.children}</body>
  </html>
)

export default layout
