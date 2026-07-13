/**
 * OVHcloud 适配器(Adapter SDK 2.0)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源结论(2026-07):
 * 1. api: 官方公开商品目录 API /v1/order/catalog/public/domain,
 *    无需凭证, 返回 900+ 后缀全量定价(EUR, 单位 1e-8) ✓ 首选
 *    - 注册价: mode=create-default, phase 0
 *    - 续费价: mode=create-default, phase 1
 *    - 转入价: mode=transfer-default, phase 0
 *    - 赎回价: mode=restore-default, phase 1
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const API_URL = "https://eu.api.ovh.com/v1/order/catalog/public/domain?ovhSubsidiary=FR"
/** OVH 目录价格单位是 1e-8 EUR */
const PRICE_UNIT = 1e8
/** OVH 用 999999 表示动态/premium 占位价, 视为无效 */
const PLACEHOLDER = 999_999

interface OvhPricing {
  mode?: string
  phase?: number
  price?: number
  capacities?: string[]
}

interface OvhPlan {
  planCode?: string
  invoiceName?: string
  pricings?: OvhPricing[]
}

function pick(pricings: OvhPricing[], mode: string, phase: number): number | null {
  const hit = pricings.find((p) => p.mode === mode && p.phase === phase)
  if (!hit || typeof hit.price !== "number") return null
  const value = hit.price / PRICE_UNIT
  if (value >= PLACEHOLDER || value < 0) return null
  return Math.round(value * 100) / 100
}

export const ovhcloudAdapter = defineAdapter({
  slug: "ovhcloud",
  name: "OVHcloud",
  website: "https://www.ovhcloud.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "EUR",
  priority: 30,
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    restore: true,
    premiumDomains: true,
    dnssec: true,
    whoisPrivacy: true,
    bulkSearch: false,
    nameservers: true,
    api: true,
    coupons: false,
    affiliate: false,
    marketplace: false,
    supportedCurrencies: ["EUR"],
    supportedLanguages: ["fr", "en", "de", "es", "it", "pl", "pt"],
  },
  rateLimit: { concurrency: 1, rpm: 4, retries: 2, timeoutMs: 120_000 },
  strategies: [
    {
      type: "api",
      url: API_URL,
      async fetch(ctx) {
        const res = await ctx.fetch(API_URL, {
          headers: { Accept: "application/json" },
        })
        if (!res.ok) throw new Error(`OVH 目录 API 返回 HTTP ${res.status}`)
        return res.text()
      },
      async parse(raw): Promise<RawPrice[]> {
        const data = JSON.parse(raw) as { plans?: OvhPlan[] }
        if (!Array.isArray(data.plans) || data.plans.length === 0) {
          throw new Error("OVH 目录 API 返回的 plans 为空")
        }
        const prices: RawPrice[] = []
        for (const plan of data.plans) {
          const tld = plan.planCode?.toLowerCase()
          if (!tld || !plan.pricings?.length) continue
          const registerPrice = pick(plan.pricings, "create-default", 0)
          const renewPrice = pick(plan.pricings, "create-default", 1)
          const transferPrice = pick(plan.pricings, "transfer-default", 0)
          const restorePrice = pick(plan.pricings, "restore-default", 1)
          if (registerPrice === null && renewPrice === null && transferPrice === null) continue
          prices.push({
            tld,
            registerPrice,
            renewPrice,
            transferPrice,
            restorePrice,
            currency: "EUR",
            sourceUrl: API_URL,
          })
        }
        return prices
      },
    },
  ],
})
