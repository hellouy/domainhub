import assert from "node:assert/strict"
import test from "node:test"
import { validatePrices } from "../packages/adapter-sdk/validation"
import type { NormalizedPrice } from "../packages/adapter-sdk/types"

function price(over: Partial<NormalizedPrice>): NormalizedPrice {
  return {
    registrar: "fixture",
    tld: "nl",
    currency: "EUR",
    registerPrice: 19.9,
    renewPrice: 19.9,
    transferPrice: null,
    restorePrice: null,
    premium: false,
    promotion: false,
    promoCode: null,
    promoCodes: null,
    promotionPrice: null,
    promotionEndsAt: null,
    region: null,
    billingPeriod: "1y",
    source: "fixture",
    sourceUrl: null,
    strategy: "html",
    adapterVersion: "1.0.0",
    parserVersion: "1.0.0",
    collectedAt: "2026-11-06T00:00:00.000Z",
    ...over,
  }
}

test("真实促销首年价 0.49 入库（transip .nl 场景）", () => {
  const [row] = validatePrices([price({ registerPrice: 0.49, renewPrice: 16.5 })], "EUR")
  assert.equal(row.status, "valid")
  assert.equal(row.price.registerPrice, 0.49)
  assert.equal(row.price.renewPrice, 16.5)
  assert.equal(row.issues.length, 0)
})

test("占位零价 0.05 置空并告警", () => {
  const [row] = validatePrices([price({ registerPrice: 0.05 })], "EUR")
  assert.equal(row.status, "warning")
  assert.equal(row.price.registerPrice, null)
  assert.ok(row.issues.some((i) => i.code === "zero-price"))
})

test("边界值：0.10 置空，0.11 保留", () => {
  const [a] = validatePrices([price({ registerPrice: 0.1 })], "EUR")
  assert.equal(a.price.registerPrice, null)
  const [b] = validatePrices([price({ registerPrice: 0.11 })], "EUR")
  assert.equal(b.status, "valid")
  assert.equal(b.price.registerPrice, 0.11)
})

test("续费价 0.49 同样保留", () => {
  const [row] = validatePrices([price({ renewPrice: 0.49 })], "EUR")
  assert.equal(row.status, "valid")
  assert.equal(row.price.renewPrice, 0.49)
})

test("transferPrice 为 0 时保留（免费转移例外）", () => {
  const [row] = validatePrices([price({ transferPrice: 0 })], "EUR")
  assert.equal(row.price.transferPrice, 0)
  assert.equal(row.issues.some((i) => i.code === "zero-price"), false)
})

test("促销价近零仍按占位处理（规则 9 不变）", () => {
  const [row] = validatePrices(
    [price({ registerPrice: 19.9, promotionPrice: 0.4, promotion: true })],
    "EUR",
  )
  assert.equal(row.price.promotionPrice, null)
  assert.ok(row.issues.some((i) => i.code === "zero-promotion"))
})

test("注册价恰好为 0 视为占位", () => {
  const [row] = validatePrices([price({ registerPrice: 0 })], "EUR")
  assert.equal(row.price.registerPrice, null)
  assert.ok(row.issues.some((i) => i.code === "zero-price"))
})
