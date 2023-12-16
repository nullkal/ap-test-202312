import * as crypto from "crypto"
import fetch, { RequestInit } from "node-fetch"

// activitypub-http-signatures には型定義がないので、苦肉の策でts-ignoreする……
// @ts-ignore
import { Sha256Signer } from "activitypub-http-signatures"

type SignedFetchOptions = {
  publicKeyId: string
  privateKey: string
  body?: string
} & RequestInit

const calculateDigest = (body: string) =>
  crypto.createHash("sha256").update(body).digest("base64")

/**
 * HTTP Signatureの署名付きでfetchする
 * @param url リクエスト先URL
 * @param options fetchのオプション
 * @returns fetchの結果
 */
const signedFetch = async (url: string, options: SignedFetchOptions) => {
  const { publicKeyId, privateKey } = options

  const digest = options.body
    ? `SHA-256=${calculateDigest(options.body)}`
    : null

  const signer = new Sha256Signer({
    publicKeyId,
    privateKey,
    headerNames: [
      "(request-target)",
      "host",
      "date",
      ...(digest ? ["digest"] : []),
    ],
  })

  const method = options.method ?? "GET"
  const headers = {
    host: new URL(url).host,
    date: new Date().toUTCString(),
    ...(digest ? { digest } : {}),
    ...options.headers,
  }
  const signature = signer.sign({ url, method, headers })
  return await fetch(url, {
    ...options,
    headers: {
      ...headers,
      signature,
      accept: "application/ld+json",
    },
  })
}

export default signedFetch
