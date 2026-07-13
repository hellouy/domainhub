/**
 * one.com 适配器(Adapter SDK 2.0)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源结论(2026-07):
 * 1. embedded-json: 域名价格页为 Next.js App Router,
 *    价格以 self.__next_f 流式内嵌(含 firstYearPrice/renewalPrice) ✓ 首选
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const PAGE_URL = "https://www.one.com/en/domain/domain-prices"

export const onecomAdapter = defineAdapter({
  slug: "onecom",
  name: "one.com",
  website: "https://www.one.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
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
        // Next.js 流式数据: \"tld\":\".xyz\" ... \"firstYearPrice\":0.99 ... \"renewalPrice\":19.99
        // 转义形式与非转义形式都尝试
        const text = raw.replace(/\\"/g, '"')
        const prices: RawPrice[] = []
        const seen = new Set<string>()
        const re =
          /"tld"\s*:\s*"\.?([a-z0-9.-]{2,30})"[^{}]*?"firstYearPrice"\s*:\s*([\d.]+)[^{}]*?"renewalPrice"\s*:\s*([\d.]+)/g
        let m: RegExpExecArray | null
        while ((m = re.exec(text)) !== null) {
          const tld = m[1].toLowerCase()
          if (seen.has(tld)) continue
          seen.add(tld)
          prices.push({
            tld,
            registerPrice: Number.parseFloat(m[2]),
            renewPrice: Number.parseFloat(m[3]),
            currency: "USD",
            sourceUrl: PAGE_URL,
          })
        }
        // 宽松模式: renewalPrice 在 firstYearPrice 前面的情况
        if (prices.length === 0) {
          const re2 =
            /"tld"\s*:\s*"\.?([a-z0-9.-]{2,30})"[^{}]*?"(?:renewalPrice|price)"\s*:\s*([\d.]+)/g
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
        if (prices.length === 0) throw new Error("one.com 页面未找到内嵌价格数据")
        return prices
      },
    },
  ],
})
