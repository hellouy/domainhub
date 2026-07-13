/**
 * Gandi 适配器(Adapter SDK 2.0)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源结论(2026-07):
 * 1. html: gandi.net/en/domain/tld 分页价格表(SSR),
 *    每页约 50 行, 逐页抓到空页为止 ✓ 首选
 * 2. api.gandi.net/v5/domain/tlds 需要 API Key(私有 API 备选,
 *    在后台配置凭证后自动启用)
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"
import { extractTableRows, findTldCell, parsePrice } from "./shared/table-adapter"

const BASE_URL = "https://www.gandi.net/en/domain/tld"
const MAX_PAGES = 25

export const gandiAdapter = defineAdapter({
  slug: "gandi",
  name: "Gandi",
  website: "https://www.gandi.net",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  priority: 40,
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    restore: true,
    dnssec: true,
    whoisPrivacy: true,
    nameservers: true,
    api: true,
    supportedCurrencies: ["USD", "EUR", "GBP", "TWD"],
    supportedLanguages: ["en", "fr", "es", "ja", "zh"],
  },
  rateLimit: { concurrency: 1, rpm: 20, retries: 2, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: BASE_URL,
      async fetch(ctx) {
        const pages: string[] = []
        for (let page = 1; page <= MAX_PAGES; page++) {
          const res = await ctx.fetch(`${BASE_URL}?page=${page}`, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
              Accept: "text/html",
            },
          })
          if (!res.ok) break
          const html = await res.text()
          // 该页解析不出任何 TLD 行时停止(比"下一页"链接更可靠)
          const rowCount = extractTableRows(html).filter((cells) => findTldCell(cells)).length
          if (rowCount === 0) break
          pages.push(html)
        }
        if (pages.length === 0) throw new Error("Gandi 价格页无法访问")
        return pages.join("\n<!--PAGE_BREAK-->\n")
      },
      parse(raw): RawPrice[] {
        const rows = extractTableRows(raw)
        const prices: RawPrice[] = []
        const seen = new Set<string>()
        for (const cells of rows) {
          const hit = findTldCell(cells)
          if (!hit) continue
          const [tld, tldIdx] = hit
          if (seen.has(tld)) continue
          const values: (number | null)[] = []
          for (let i = tldIdx + 1; i < cells.length; i++) values.push(parsePrice(cells[i]))
          if (values.every((v) => v === null)) continue
          seen.add(tld)
          prices.push({
            tld,
            registerPrice: values[0] ?? null,
            renewPrice: values[1] ?? null,
            transferPrice: values[2] ?? null,
            currency: "USD",
            sourceUrl: BASE_URL,
          })
        }
        if (prices.length === 0) throw new Error("Gandi 表格解析结果为空")
        return prices
      },
    },
  ],
})
