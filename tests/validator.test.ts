import { describe, expect, it } from "vitest"
import { ValidatorService } from "@/services/validator"
import type { DomainPrice } from "@/lib/crawler/types"

function price(overrides: Partial<DomainPrice> = {}): DomainPrice {
  return {
    registrar: "testreg",
    tld: "com",
    register_price: 10.5,
    renew_price: 12,
    transfer_price: 9.5,
    currency: "USD",
    source: "https://example.com",
    checked_at: new Date(),
    ...overrides,
  }
}

describe("ValidatorService", () => {
  const validator = new ValidatorService()

  it("接受合法记录", () => {
    const { valid, rejected } = validator.validate([price()])
    expect(valid).toHaveLength(1)
    expect(rejected).toHaveLength(0)
  })

  it("拒绝缺失注册价的记录", () => {
    const { valid, rejected } = validator.validate([price({ register_price: null })])
    expect(valid).toHaveLength(0)
    expect(rejected[0].reason).toContain("缺少注册价格")
  })

  it("拒绝非正数价格", () => {
    const { rejected } = validator.validate([
      price({ register_price: 0 }),
      price({ tld: "net", renew_price: -1 }),
      price({ tld: "org", transfer_price: Number.NaN }),
    ])
    expect(rejected).toHaveLength(3)
  })

  it("拒绝非法币种", () => {
    const { rejected } = validator.validate([
      price({ currency: "" }),
      price({ tld: "net", currency: "usd" }),
      price({ tld: "org", currency: "USDT" }),
    ])
    expect(rejected).toHaveLength(3)
  })

  it("拒绝非法后缀格式", () => {
    const { rejected } = validator.validate([
      price({ tld: "COM" }),
      price({ tld: "-abc" }),
      price({ tld: "a b" }),
      price({ tld: "" }),
    ])
    expect(rejected).toHaveLength(4)
  })

  it("接受多级后缀（co.uk）", () => {
    const { valid } = validator.validate([price({ tld: "co.uk" })])
    expect(valid).toHaveLength(1)
  })

  it("拒绝同批次重复后缀，保留首条", () => {
    const { valid, rejected } = validator.validate([
      price({ register_price: 10 }),
      price({ register_price: 99 }),
    ])
    expect(valid).toHaveLength(1)
    expect(valid[0].register_price).toBe(10)
    expect(rejected[0].reason).toContain("重复")
  })

  it("续费/转入价为 null 时仍然合法", () => {
    const { valid } = validator.validate([price({ renew_price: null, transfer_price: null })])
    expect(valid).toHaveLength(1)
  })
})
