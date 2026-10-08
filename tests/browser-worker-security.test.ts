import assert from "node:assert/strict"
import test from "node:test"
import { assertPublicHttpUrl, isPublicAddress } from "../browser-worker/src/security"

test("公网 IP 分类允许公共地址并拒绝保留地址", () => {
  assert.equal(isPublicAddress("8.8.8.8"), true)
  assert.equal(isPublicAddress("10.0.0.1"), false)
  assert.equal(isPublicAddress("169.254.169.254"), false)
  assert.equal(isPublicAddress("::1"), false)
  assert.equal(isPublicAddress("::ffff:127.0.0.1"), false)
  assert.equal(isPublicAddress("2001:db8::1"), false)
  assert.equal(isPublicAddress("2001:4860:4860::8888"), true)
})

test("HTTP(S) 目标校验拒绝私网、凭据和非标准端口", async () => {
  await assert.rejects(assertPublicHttpUrl("http://127.0.0.1/"), /非公网地址/)
  await assert.rejects(assertPublicHttpUrl("http://[::1]/"), /非公网地址/)
  await assert.rejects(assertPublicHttpUrl("https://user:pass@example.com/"), /无凭据/)
  await assert.rejects(assertPublicHttpUrl("https://example.com:8443/"), /默认端口/)
  await assert.doesNotReject(assertPublicHttpUrl("https://8.8.8.8/"))
})
