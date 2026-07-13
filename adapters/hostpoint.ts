/**
 * Hostpoint 适配器
 * ------------------------------------------------------------
 * 所有权: Data Team
 * 数据源: 官方价格 fragment API(返回 HTML 瓦片, 带 data-* 价格属性)
 *   https://www.hostpoint.ch/api/domain-price-api.php?lang=en
 * 结构: <div class="domains7-tile" data-ren="15.00" data-tra="0.00">
 *         <div class="title">.ch</div><div class="price">5.00</div>
 * 货币: CHF
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const API_URL = "https://www.hostpoint.ch/api/domain-price-api.php?lang=en"

const num = (v: string | undefined): number | null => {
  if (!v) return null
  const n = Number.parseFloat(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

export const hostpointAdapter = defineAdapter({
  slug: "hostpoint",
  name: "Hostpoint",
  website: "https://www.hostpoint.ch",
  owner: "Data Team",
  version: "1.1.0",
  parserVersion: "1.1.0",
  currency: "CHF",
  priority: 50,
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    dnssec: true,
    whoisPrivacy: true,
    supportedCurrencies: ["CHF"],
  },
  rateLimit: { concurrency: 1, rpm: 6, retries: 2, timeoutMs: 60_000 },
  strategies: [
    {
      type: "xhr",
      url: API_URL,
      async fetch(ctx) {
        const res = await ctx.fetch(API_URL, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            Accept: "text/html",
            Referer: "https://www.hostpoint.ch/en/domains/domains.html",
          },
        })
        if (!res.ok) throw new Error(`Hostpoint API 返回 HTTP ${res.status}`)
        return await res.text()
      },
      parse(raw): RawPrice[] {
        const prices: RawPrice[] = []
        const seen = new Set<string>()
        // 每个瓦片: data 属性 + .title(.tld) + .price(注册价)
        const tileRe =
          /<div class="domains7-tile[^"]*"([^>]*)>[\s\S]*?<div class="title">\.([a-z0-9.-]+)<\/div><div class="price">([\d.]+)<\/div>/gi
        let m: RegExpExecArray | null
        while ((m = tileRe.exec(raw)) !== null) {
          const attrs = m[1]
          const tld = m[2].toLowerCase()
          if (seen.has(tld)) continue
          const register = num(m[3])
          const ren = num(/data-ren="([\d.]+)"/.exec(attrs)?.[1])
          const tra = num(/data-tra="([\d.]+)"/.exec(attrs)?.[1])
          const res = num(/data-res="([\d.]+)"/.exec(attrs)?.[1])
          if (register === null && ren === null) continue
          seen.add(tld)
          prices.push({
            tld,
            currency: "CHF",
            registerPrice: register,
            renewPrice: ren ?? register,
            transferPrice: tra,
            restorePrice: res,
            sourceUrl: "https://www.hostpoint.ch/en/domains/domains.html",
          })
        }
        if (prices.length === 0) throw new Error("Hostpoint fragment 解析结果为空(结构可能已变化)")
        return prices
      },
    },
  ],
})
