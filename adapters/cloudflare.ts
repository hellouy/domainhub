/**
 * Cloudflare Registrar 适配器(Adapter SDK 2.0)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源结论(2026-07):
 * 1. api: Cloudflare 无公开注册商定价 API(定价在 dash 登录后)
 * 2. json: cfdomainpricing.com/prices.json —— 社区维护的全量定价
 *    数据集(400+ 后缀), 最可靠的机器可读来源 ✓ 首选
 * 3. html: 官网 tld-policies 页面不含价格, 无需降级到此
 *
 * Cloudflare 按批发价销售: 转入价 = 续费价。
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const SOURCE_URL = "https://cfdomainpricing.com/prices.json"

interface CloudflarePriceEntry {
  registration?: number
  renewal?: number
}

export const cloudflareAdapter = defineAdapter({
  slug: "cloudflare",
  name: "Cloudflare",
  website: "https://www.cloudflare.com/products/registrar/",
  owner: "Data Team",
  version: "2.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  priority: 10,
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    dnssec: true,
    whoisPrivacy: true,
    nameservers: true,
    api: false,
    premiumDomains: false,
    coupons: false,
    affiliate: false,
    marketplace: false,
    supportedCurrencies: ["USD"],
    supportedLanguages: ["en"],
  },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "json",
      url: SOURCE_URL,
      async parse(raw): Promise<RawPrice[]> {
        const data = JSON.parse(raw) as Record<string, CloudflarePriceEntry>
        if (data === null || typeof data !== "object" || Array.isArray(data)) {
          throw new Error("数据源返回了非预期的 JSON 结构")
        }
        const prices: RawPrice[] = []
        for (const [tld, entry] of Object.entries(data)) {
          const register =
            typeof entry.registration === "number" && entry.registration > 0
              ? entry.registration
              : null
          const renew =
            typeof entry.renewal === "number" && entry.renewal > 0 ? entry.renewal : null
          if (register === null && renew === null) continue
          prices.push({
            tld,
            registerPrice: register,
            renewPrice: renew,
            // Cloudflare 按成本价销售, 转入价与续费价一致
            transferPrice: renew,
            currency: "USD",
            sourceUrl: SOURCE_URL,
          })
        }
        return prices
      },
    },
  ],
})
