import Layout from "./_layout"

const error = (msg: String) => (
  <Layout>
    <h2>ERROR!</h2>
    <p>{msg}</p>
  </Layout>
)

export default error
