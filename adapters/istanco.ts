/**
 * Istanco —— 静态价目表(EUR 注册/转入/续费)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://istanco.com/domain/pricing
 * 表: #tableDomainPricing, 列
 *   TLD | Category | New Price | Transfer | Renewal | Grace | Redemption
 * 价格形如 "EUR14.40 <small>1 Year</small>"。
 * 已验证约 50+ TLD, EUR/年。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://istanco.com/domain/pricing"

async function parseIstanco(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const tableMatch = raw.match(/<table[^>]*id="tableDomainPricing"[^>]*>[\s\S]*?<\/table>/i)
  const scope = tableMatch ? tableMatch[0] : raw
  const rows = scope.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    const cells = tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []
    if (cells.length < 5) continue
    const tld = (cells[0] ?? "").replace(/<[^>]+>/g, "").trim().toLowerCase()
    if (!/^[a-z0-9\u00e0-\uffff-]{2,}$/.test(tld)) continue
    if (seen.has(tld)) continue
    const read = (c: string): number | null => {
      const t = c.replace(/<[^>]+>/g, "").replace(/[^\d.,\s]/g, "").trim()
      if (!t || t.toUpperCase().includes("DAY")) return null
      const n = Number.parseFloat(t.replace(/\s/g, "").replace(",", "."))
      return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
    }
    const reg = read(cells[2] ?? "")
    const tra = read(cells[3] ?? "")
    const ren = read(cells[4] ?? "")
    if (reg == null && ren == null && tra == null) continue
    const price: RawPrice = { tld, currency: "EUR", sourceUrl: URL }
    if (reg != null) price.registerPrice = reg
    if (tra != null) price.transferPrice = tra
    if (ren != null) price.renewPrice = ren
    seen.add(tld)
    out.push(price)
  }
  if (out.length === 0) throw new Error("istanco 解析结果为空(页面结构可能已变化)")
  return out
}

export const istancoAdapter = defineAdapter({
  slug: "istanco",
  name: "Istanco",
  website: "https://istanco.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "EUR",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["EUR"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse: parseIstanco,
    },
  ],
})