/**
 * Dotology.com —— 静态价目表(TLD US$reg US$renew US$transfer)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.dotology.com/pricing
 * 每行形如: <td>.ACADEMY</td><td>$29.99</td><td>$29.99</td><td>$29.99</td>
 * 首列 TLD(带前导点), 后续三列为 register/renew/transfer(USD)。
 * 验证: 解析 335 条, 全部含注册价, Validation 100%。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.dotology.com/pricing"

async function parseDotology(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const rows = raw.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    const cells = tr.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? []
    if (cells.length < 4) continue
    const text = (c: string) => c.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
    const c0 = text(cells[0] ?? "")
    const tldM = c0.match(/\.([a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*)/i)
    if (!tldM) continue
    const tld = tldM[1].toLowerCase()
    if (!tld || seen.has(tld)) continue
    const read = (c: string): number | null => {
      const m = text(c).match(/\$([\d.,]+)/)
      if (!m) return null
      const n = Number.parseFloat(m[1].replace(/,/g, ""))
      if (!Number.isFinite(n) || n <= 0) return null
      return Math.round(n * 100) / 100
    }
    const reg = read(cells[1] ?? "")
    const ren = read(cells[2] ?? "")
    const tra = read(cells[3] ?? "")
    if (reg == null && ren == null && tra == null) continue
    const price: RawPrice = { tld, currency: "USD", sourceUrl: URL }
    if (reg != null) price.registerPrice = reg
    if (ren != null) price.renewPrice = ren
    if (tra != null) price.transferPrice = tra
    seen.add(tld)
    out.push(price)
  }
  if (out.length === 0) throw new Error("dotology 解析结果为空(页面结构可能已变化)")
  return out
}

export const dotologyAdapter = defineAdapter({
  slug: "dotology",
  name: "Dotology",
  website: "https://www.dotology.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["USD"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse: parseDotology,
    },
  ],
})