/**
 * Porkbun 适配器(Adapter SDK 2.0)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源结论(2026-07):
 * 1. api: 官方公开定价 API POST /api/json/v3/pricing/get,
 *    无需凭证, 返回 900+ 后缀全量定价 ✓ 首选
 * 2. html: porkbun.com/products/domains 页面为客户端渲染, 无需降级
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const API_URL = "https://api.porkbun.com/api/json/v3/pricing/get"

interface PorkbunPricingEntry {
  registration?: string
  renewal?: string
  transfer?: string
  coupons?: unknown[]
}

interface PorkbunResponse {
  status?: string
  pricing?: Record<string, PorkbunPricingEntry>
}

export const porkbunAdapter = defineAdapter({
  slug: "porkbun",
  name: "Porkbun",
  website: "https://porkbun.com",
  owner: "Data Team",
  version: "2.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  priority: 20,
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    restore: true,
    premiumDomains: true,
    dnssec: true,
    whoisPrivacy: true,
    bulkSearch: true,
    nameservers: true,
    api: true,
    coupons: true,
    affiliate: true,
    marketplace: true,
    supportedCurrencies: ["USD"],
    supportedLanguages: ["en"],
  },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "api",
      url: API_URL,
      async fetch(ctx) {
        const res = await ctx.fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
        if (!res.ok) throw new Error(`Porkbun API 返回 HTTP ${res.status}`)
        return res.text()
      },
      async parse(raw): Promise<RawPrice[]> {
        const data = JSON.parse(raw) as PorkbunResponse
        if (data.status !== "SUCCESS" || !data.pricing) {
          throw new Error(`Porkbun API 返回异常状态: ${data.status ?? "unknown"}`)
        }
        const prices: RawPrice[] = []
        for (const [tld, entry] of Object.entries(data.pricing)) {
          const hasCoupon = Array.isArray(entry.coupons) && entry.coupons.length > 0
          prices.push({
            tld,
            registerPrice: entry.registration ?? null,
            renewPrice: entry.renewal ?? null,
            transferPrice: entry.transfer ?? null,
            currency: "USD",
            promotion: hasCoupon,
            sourceUrl: API_URL,
          })
        }
        return prices
      },
    },
  ],
})
