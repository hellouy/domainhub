/**
 * one.com 适配器(Adapter SDK 2.0)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源结论(2026-10):
 * 1. embedded-json: 域名价格页为 Next.js App Router,
 *    价格以 self.__next_f 流式内嵌，字段为 fullPriceExclCurrencyAsString /
 *    rebatePriceExclCurrencyAsString（2026-07 的 firstYearPrice/renewalPrice 已废弃）
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const PAGE_URL = "https://www.one.com/en/domain/domain-prices"

export const onecomAdapter = defineAdapter({
  slug: "onecom",
  name: "one.com",
  website: "https://www.one.com",
  owner: "Data Team",
  version: "1.1.0",
  parserVersion: "1.1.0",
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
      type: "embedded-json",
      url: PAGE_URL,
      async fetch(ctx) {
        const res = await ctx.fetch(PAGE_URL, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            Accept: "text/html",
          },
        })
        if (!res.ok) throw new Error(`one.com 价格页返回 HTTP ${res.status}`)
        return res.text()
      },
      parse(raw): RawPrice[] {
        // Next.js 流式数据, 转义引号还原
        const text = raw.replace(/\\"/g, '"')
        const prices: RawPrice[] = []
        const seen = new Set<string>()

        // 新格式: "tld":".com", ... "fullPriceExclCurrencyAsString":"21.99", "rebatePriceExclCurrencyAsString":"7.99"
        // fallback 块内含 tld + data 对象
        const re =
          /"tld"\s*:\s*"\.?([a-z0-9.-]{2,30})"[^{}]*?"fullPriceExclCurrencyAsString"\s*:\s*"([\d.]+)"[^{}]*?"rebatePriceExclCurrencyAsString"\s*:\s*"([\d.]+)"/g
        let m: RegExpExecArray | null
        while ((m = re.exec(text)) !== null) {
          const tld = m[1].toLowerCase()
          if (seen.has(tld)) continue
          seen.add(tld)
          const fullPrice = Number.parseFloat(m[2])
          const rebate = Number.parseFloat(m[3])
          prices.push({
            tld,
            registerPrice: fullPrice,
            renewPrice: fullPrice,
            ...(rebate < fullPrice ? { promotionPrice: rebate } : {}),
            currency: "USD",
            sourceUrl: PAGE_URL,
          })
        }

        // 宽松模式: fullPrice 在 rebate 之后
        if (prices.length === 0) {
          const re2 =
            /"tld"\s*:\s*"\.?([a-z0-9.-]{2,30})"[^{}]*?"fullPriceExclCurrencyAsString"\s*:\s*"([\d.]+)"/g
          while ((m = re2.exec(text)) !== null) {
            const tld = m[1].toLowerCase()
            if (seen.has(tld)) continue
            seen.add(tld)
            prices.push({
              tld,
              registerPrice: Number.parseFloat(m[2]),
              currency: "USD",
              sourceUrl: PAGE_URL,
            })
          }
        }

        // 旧格式兜底: firstYearPrice / renewalPrice
        if (prices.length === 0) {
          const re3 =
            /"tld"\s*:\s*"\.?([a-z0-9.-]{2,30})"[^{}]*?"firstYearPrice"\s*:\s*([\d.]+)[^{}]*?"renewalPrice"\s*:\s*([\d.]+)/g
          while ((m = re3.exec(text)) !== null) {
            const tld = m[1].toLowerCase()
            if (seen.has(tld)) continue
            seen.add(tld)
            const firstYear = Number.parseFloat(m[2])
            const renew = Number.parseFloat(m[3])
            prices.push({
              tld,
              registerPrice: renew,
              renewPrice: renew,
              ...(firstYear < renew ? { promotionPrice: firstYear } : {}),
              currency: "USD",
              sourceUrl: PAGE_URL,
            })
          }
        }

        if (prices.length === 0) throw new Error("one.com 页面未找到内嵌价格数据")
        return prices
      },
    },
  ],
})
