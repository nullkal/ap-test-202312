import { Context } from "hono"

export const NotFound = (c: Context) => {
  return c.json(
    {
      error: "not_found",
    },
    404
  )
}

export const InvalidObject = (c: Context) => {
  return c.json(
    {
      error: "invalid_object",
    },
    400
  )
}

export const InvalidType = (c: Context) => {
  return c.json(
    {
      error: "invalid_type",
    },
    400
  )
}

export const Success = (c: Context) => {
  return c.json({})
}
