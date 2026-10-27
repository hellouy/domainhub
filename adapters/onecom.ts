/**
 * one.com 适配器(Adapter SDK 2.0)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源结论(2026-10):
 * 1. api: one.com 价格页已迁移为 Next.js SPA, 页面仅内嵌 2 个精选 TLD 价格。
 *    完整价格通过 REST API 获取:
 *    - GET /rest/tlds/popular/?country=US → 精选 TLD 列表(20 个)
 *    - GET /rest/tlds/{tld}/display-prices/?country=US → 单个 TLD 价格
 *    country=US 返回 USD 价格。
 *
 * 历史(2026-07): embedded-json 策略可从 self.__next_f 流提取全量 TLD,
 * 但 2026-10 改版后页面仅展示精选 TLD, 内嵌数据缩至 2 条, 已废弃。
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const API_BASE = "https://www.one.com/rest/tlds"
const COUNTRY = "US"

export const onecomAdapter = defineAdapter({
  slug: "onecom",
  name: "one.com",
  website: "https://www.one.com",
  owner: "Data Team",
  version: "2.0.0",
  parserVersion: "2.0.0",
  currency: "USD",
  priority: 60,
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    dnssec: true,
    nameservers: true,
    supportedCurrencies: ["USD", "EUR", "GBP", "SEK", "DKK", "NOK"],
    supportedLanguages: ["en", "de", "fr", "es", "sv", "da", "no", "nl"],
  },
  rateLimit: { concurrency: 1, rpm: 10, retries: 2, timeoutMs: 60_000 },
  strategies: [
    {
      type: "api",
      url: `${API_BASE}/popular/?country=${COUNTRY}`,
      async fetch(ctx) {
        // Step 1: 获取精选 TLD 列表
        const listRes = await ctx.fetch(`${API_BASE}/popular/?country=${COUNTRY}`, {
          headers: { Accept: "application/json" },
        })
        if (!listRes.ok) throw new Error(`one.com TLD 列表返回 HTTP ${listRes.status}`)
        const listData = await listRes.json()
        const tlds: string[] = listData?.result?.tlds ?? []
        if (tlds.length === 0) throw new Error("one.com 未返回 TLD 列表")

        // Step 2: 逐个获取 TLD 价格
        const results: Array<{ tld: string; data: Record<string, unknown> }> = []
        for (const tld of tlds) {
          const priceRes = await ctx.fetch(
            `${API_BASE}/${encodeURIComponent(tld)}/display-prices/?country=${COUNTRY}`,
            { headers: { Accept: "application/json" } },
          )
          if (!priceRes.ok) continue
          const priceData = await priceRes.json()
          results.push({ tld, data: priceData })
        }

        if (results.length === 0) throw new Error("one.com 所有 TLD 价格查询均失败")
        return JSON.stringify(results)
      },
      parse(raw): RawPrice[] {
        const items = JSON.parse(raw) as Array<{
          tld: string
          data: {
            fullPriceExclCurrencyAsString?: string
            rebatePriceExclCurrencyAsString?: string
            currency?: string
          }
        }>

        const prices: RawPrice[] = []
        for (const item of items) {
          const tld = item.tld.replace(/^\./, "").toLowerCase()
          const fullStr = item.data?.fullPriceExclCurrencyAsString
          if (!fullStr) continue
          const fullPrice = Number.parseFloat(fullStr)
          if (Number.isNaN(fullPrice)) continue

          const rebateStr = item.data?.rebatePriceExclCurrencyAsString
          const rebate = rebateStr ? Number.parseFloat(rebateStr) : NaN

          prices.push({
            tld,
            registerPrice: fullPrice,
            renewPrice: fullPrice,
            ...(rebate < fullPrice ? { promotionPrice: rebate } : {}),
            currency: "USD",
            sourceUrl: `${API_BASE}/${encodeURIComponent(item.tld)}/display-prices/?country=${COUNTRY}`,
          })
        }

        if (prices.length === 0) throw new Error("one.com 价格解析结果为空")
        return prices
      },
    },
  ],
})
