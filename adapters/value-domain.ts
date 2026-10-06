/**
 * Value Domain —— 日本注册商（JPY，多注册商聚合）
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.value-domain.com/domain/price/index.html
 * browser-probe 渲染成功, 216 行价格表
 * 列: ドメイン名 | 新規取得（初年度）| 更新/年 | 移管 | 新規取得（定向）| WHOIS代行
 * 特点: 同一 TLD 有多个注册商行（eNom/GMO/KeySystems）
 * 币种 JPY。标准价取第一个（eNom）行
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.value-domain.com/domain/price/index.html"

function parseJpy(s: string | null | undefined): number | null {
  if (!s) return null
  const m = s.replace(/[^0-9.]/g, "")
  const v = Number.parseFloat(m)
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null
}

export const valuedomainAdapter = defineAdapter({
  slug: "value-domain",
  name: "Value Domain",
  website: "https://www.value-domain.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "JPY",
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    supportedCurrencies: ["JPY"],
  },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "playwright",
      url: URL,
      browser: {
        extract: "html",
        scrollToBottom: false,
        waitForTimeoutMs: 15_000,
      },
      async parse(raw: string): Promise<RawPrice[]> {
        const out: RawPrice[] = []
        const seen = new Set<string>()
        const tableMatch = raw.match(/<table[^>]*>([\s\S]*?)<\/table>/i)
        if (!tableMatch) throw new Error("Value Domain 页面未找到表格")
        const rows = tableMatch[1].match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []
        for (const row of rows) {
          const cells = [...row.matchAll(/<(td|th)[^>]*>([\s\S]*?)<\/(td|th)>/gi)].map(m =>
            m[2].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/[\s]+/g, " ").trim(),
          )
          if (cells.length === 0) continue
          const first = cells[0].toLowerCase()
          if (first.includes("ドメイン") || first.includes("新規取得") || first.includes("domain")) continue
          const tldRaw = cells[0].replace(/（.*$/, "").replace(/^\./, "").toLowerCase().trim()
          if (!tldRaw || !/^[a-z0-9]/.test(tldRaw)) continue
          if (cells.length < 4) continue
          const price: RawPrice = { tld: tldRaw, currency: "JPY", sourceUrl: URL }
          price.registerPrice = parseJpy(cells[1])
          price.renewPrice = parseJpy(cells[2])
          price.transferPrice = parseJpy(cells[3])
          if (price.registerPrice == null && price.renewPrice == null) continue
          const key = tldRaw
          if (!seen.has(key)) {
            seen.add(key)
            out.push(price)
          }
        }
        if (out.length < 5) throw new Error(`Value Domain 解析行数异常: ${out.length}`)
        return out
      },
    },
  ],
})