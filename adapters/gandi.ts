/**
 * Gandi —— 法国注册商价目(EUR)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.gandi.net/en/domain (静态 HTML 价目表)
 * 表: TLD | Register | Renew | Transfer
 * Register 列格式: "€11.00" 或 "Promo €17.26 €11.99" (促销/原价)
 *  币种 EUR。验证: 10 TLD (.com/.net/.xyz/.fr/.nz/.eu/.app/.co.uk/.online/.me)
 * 注意: Renew 价格较高(如 .net €40) 为 Gandi 官方定价
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.gandi.net/en/domain"

function parseEur(s: string | null | undefined): number | null {
  if (!s) return null
  const m = s.replace(/[^0-9.,]/g, "").replace(",", ".")
  const v = Number.parseFloat(m)
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null
}

export const gandiAdapter = defineAdapter({
  slug: "gandi",
  name: "Gandi",
  website: "https://www.gandi.net",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "EUR",
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    supportedCurrencies: ["EUR"],
  },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      async parse(raw: string): Promise<RawPrice[]> {
        const out: RawPrice[] = []
        const seen = new Set<string>()
        const tableMatch = raw.match(/<table[^>]*>([\s\S]*?)<\/table>/i)
        if (!tableMatch) throw new Error("Gandi 页面未找到表格")
        const rows = tableMatch[1].match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []
        for (const row of rows) {
          const cells = [...row.matchAll(/<(td|th)[^>]*>([\s\S]*?)<\/(td|th)>/gi)].map(m =>
            m[2].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/[\s]+/g, " ").trim(),
          )
          if (cells.length < 4) continue
          const tldRaw = cells[0].replace(/^\./, "").toLowerCase().trim()
          if (!tldRaw || !/^[a-z0-9]/.test(tldRaw) || seen.has(tldRaw)) continue
          const regRaw = cells[1]
          const renRaw = cells[2]
          const traRaw = cells[3]
          const price: RawPrice = { tld: tldRaw, currency: "EUR", sourceUrl: URL }
          if (regRaw.includes("Promo")) {
            const nums = [...regRaw.matchAll(/([€]?[\d]+[.,]\d{2})/g)].map(m => parseEur(m[1]))
            if (nums.length >= 2) {
              price.registerPrice = Math.max(...nums.filter(v => v != null) as number[])
              price.promotionPrice = Math.min(...nums.filter(v => v != null) as number[])
            } else if (nums.length === 1) {
              price.registerPrice = nums[0]!
            }
          } else {
            price.registerPrice = parseEur(regRaw)
          }
          price.renewPrice = parseEur(renRaw)
          price.transferPrice = traRaw === "FREE" ? null : parseEur(traRaw)
          seen.add(tldRaw)
          out.push(price)
        }
        if (out.length < 5) throw new Error(`Gandi 解析行数异常: ${out.length}`)
        return out
      },
    },
  ],
})
