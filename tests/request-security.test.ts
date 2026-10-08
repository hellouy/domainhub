import assert from "node:assert/strict"
import test from "node:test"
import type { NextRequest } from "next/server"
import { hasValidCronAuthorization } from "../lib/cron-auth"
import { isSameOriginRequest } from "../lib/request-origin"

function requestWithOrigin(origin: string | null, requestUrl = "https://app.example/admin") {
  const headers = new Headers()
  if (origin) headers.set("origin", origin)
  return {
    headers,
    nextUrl: new URL(requestUrl),
  } as unknown as NextRequest
}

test("Cron 鉴权要求足够长且完全匹配的 Bearer 密钥", () => {
  const original = process.env.CRON_SECRET
  const secret = "test-cron-secret-0123456789abcdef"
  process.env.CRON_SECRET = secret
  try {
    assert.equal(
      hasValidCronAuthorization(new Request("https://app.example/api/cron", { headers: { authorization: `Bearer ${secret}` } })),
      true,
    )
    assert.equal(
      hasValidCronAuthorization(new Request("https://app.example/api/cron", { headers: { authorization: "Bearer wrong" } })),
      false,
    )
    assert.equal(hasValidCronAuthorization(new Request("https://app.example/api/cron")), false)
    process.env.CRON_SECRET = "short"
    assert.equal(
      hasValidCronAuthorization(new Request("https://app.example/api/cron", { headers: { authorization: "Bearer short" } })),
      false,
    )
  } finally {
    if (original === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = original
  }
})

test("状态变更 API 只接受精确同源 Origin", () => {
  assert.equal(isSameOriginRequest(requestWithOrigin("https://app.example")), true)
  assert.equal(isSameOriginRequest(requestWithOrigin("https://attacker.example")), false)
  assert.equal(isSameOriginRequest(requestWithOrigin(null)), false)
  assert.equal(isSameOriginRequest(requestWithOrigin("not a URL")), false)
})
