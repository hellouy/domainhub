/**
 * Dynadot 适配器(Adapter SDK 2.0)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源结论(2026-07):
 * 1. api: Dynadot 官方 API 需账户凭证, 不适合公开定价采集
 * 2. xhr: /dynadot-vue-api/dynadot-service/domain-search?command=get_current_list
 *    —— 站点前端使用的内部 XHR 端点, 返回 800+ 后缀全量定价
 *    (含注册/续费/转入/赎回价与促销原价) ✓ 首选
 * 3. html: /domain/tlds 页面为 Vue 客户端渲染, 直接解析 HTML 拿不到
 *    价格, 故 XHR 失败时无静态 HTML 可降级(保留 playwright 位)
 *
 * 促销检测: original_reg_price != "-1" 时表示当前注册价为促销价。
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const XHR_URL =
  "https://www.dynadot.com/dynadot-vue-api/dynadot-service/domain-search?command=get_current_list&lang=en"
const PRICING_PAGE = "https://www.dynadot.com/domain/tlds"

interface DynadotTldEntry {
  name?: string
  reg_price?: string
  original_reg_price?: string
  renew_price?: string
  tr_price?: string
  restore?: string
}

interface DynadotResponse {
  data?: { current_tlds?: DynadotTldEntry[] }
}

export const dynadotAdapter = defineAdapter({
  slug: "dynadot",
  name: "Dynadot",
  website: "https://www.dynadot.com",
  owner: "Data Team",
  version: "2.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  priority: 30,
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
    supportedLanguages: ["en", "zh"],
  },
  rateLimit: { concurrency: 1, rpm: 6, retries: 3, timeoutMs: 90_000 },
  strategies: [
    {
      type: "xhr",
      url: XHR_URL,
      async fetch(ctx) {
        const res = await ctx.fetch(XHR_URL, {
          headers: {
            Accept: "application/json",
            Referer: PRICING_PAGE,
          },
        })
        if (!res.ok) throw new Error(`Dynadot XHR 端点返回 HTTP ${res.status}`)
        return res.text()
      },
      async parse(raw): Promise<RawPrice[]> {
        const data = JSON.parse(raw) as DynadotResponse
        const entries = data.data?.current_tlds
        if (!Array.isArray(entries) || entries.length === 0) {
          throw new Error("Dynadot XHR 返回中未找到 current_tlds 列表(接口结构可能已变化)")
        }
        const prices: RawPrice[] = []
        for (const entry of entries) {
          if (!entry.name) continue
          const isPromo =
            typeof entry.original_reg_price === "string" && entry.original_reg_price !== "-1"
          prices.push({
            tld: entry.name,
            registerPrice: entry.reg_price ?? null,
            renewPrice: entry.renew_price ?? null,
            transferPrice: entry.tr_price ?? null,
            restorePrice: entry.restore ?? null,
            currency: "USD",
            promotion: isPromo,
            sourceUrl: PRICING_PAGE,
          })
        }
        return prices
      },
    },
  ],
})
