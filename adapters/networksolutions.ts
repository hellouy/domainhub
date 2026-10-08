/**
 * Network Solutions —— 美国老牌注册商(USD)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.networksolutions.com/domains/domain-name-pricing
 * browser-probe 渲染成功, 33 行价格表
 * 表头: TLD | Registration | Renewal | Transfer
 * 币种 USD。验证: 33 TLD, .com $19.99/.net $19.99/.org $19.99
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.networksolutions.com/domains/domain-name-pricing"

function parseUsd(s: string | null | undefined): number | null {
  if (!s) return null
  const m = s.replace(/[^0-9.]/g, "")
  const v = Number.parseFloat(m)
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null
}

export const networksolutionsAdapter = defineAdapter({
  slug: "networksolutions",
  name: "Network Solutions",
  website: "https://www.networksolutions.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    supportedCurrencies: ["USD"],
  },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "playwright",
      url: URL,
      browser: {
        extract: "html",
        scrollToBottom: false,
        waitForTimeoutMs: 12_000,
      },
      async parse(raw: string): Promise<RawPrice[]> {
        const out: RawPrice[] = []
        const seen = new Set<string>()
        const tableMatch = raw.match(/<table[^>]*>([\s\S]*?)<\/table>/i)
        if (!tableMatch) throw new Error("Network Solutions 页面未找到表格")
        const rows = tableMatch[1].match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []
        for (const row of rows) {
          const cells = [...row.matchAll(/<(td|th)[^>]*>([\s\S]*?)<\/(td|th)>/gi)].map(m =>
            m[2].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/[\s]+/g, " ").trim(),
          )
          if (cells.length === 0) continue
          // 跳过表头
          const first = cells[0].toLowerCase()
          if (first.includes("tld") || first.includes("domain") || first.includes("pricing")) continue
          const tldRaw = cells[0].replace(/^\./, "").toLowerCase().trim()
          if (!tldRaw || !/^[a-z0-9]/.test(tldRaw) || seen.has(tldRaw)) continue
          if (cells.length < 3) continue
          const price: RawPrice = { tld: tldRaw, currency: "USD", sourceUrl: URL }
          price.registerPrice = parseUsd(cells[1])
          price.renewPrice = parseUsd(cells[2])
          if (cells[3]) price.transferPrice = parseUsd(cells[3])
          if (price.registerPrice == null && price.renewPrice == null) continue
          seen.add(tldRaw)
          out.push(price)
        }
        if (out.length < 5) throw new Error(`Network Solutions 解析行数异常: ${out.length}`)
        return out
      },
    },
  ],
})