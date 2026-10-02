/**
 * HostAfrica —— 静态价目表(ZAR)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://hostafrica.co.za/domains
 * 表: #domains_table, 列 Domain | Category | Register | Transfer | Renewal | (Button)
 * 价格 "R49"(注册), "R0"(转入,不提供), "R109"(续费)。
 * 已验证约 10 TLD, ZAR/年。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://hostafrica.co.za/domains"

async function parseHostAfrica(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const tableMatch = raw.match(/<table[^>]*id="domains_table"[^>]*>[\s\S]*?<\/table>/i)
  const scope = tableMatch ? tableMatch[0] : raw
  const rows = scope.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    if (/<th[ >]/i.test(tr)) continue
    const cells = tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []
    if (cells.length < 5) continue
    const tld = (cells[0] ?? "").replace(/<[^>]+>/g, "").replace(/[^a-z0-9.-]/gi, "").trim().toLowerCase().replace(/^\./, "")
    if (!tld || !/^[a-z0-9][a-z0-9-]*(\.[a-z]{2,})?$/.test(tld)) continue
    if (seen.has(tld)) continue
    const read = (c: string): number | null => {
      const t = c.replace(/<[^>]+>/g, "").replace(/[^\d.\s]/g, "").trim()
      if (!t) return null
      const n = Number.parseFloat(t.replace(/\s/g, ""))
      if (!Number.isFinite(n) || n <= 0) return null
      return Math.round(n * 100) / 100
    }
    const reg = read(cells[2])
    const tra = read(cells[3])
    const ren = read(cells[4])
    if (reg == null && ren == null && tra == null) continue
    const price: RawPrice = { tld, currency: "ZAR", sourceUrl: URL }
    if (reg != null) price.registerPrice = reg
    if (tra != null) price.transferPrice = tra
    if (ren != null) price.renewPrice = ren
    seen.add(tld)
    out.push(price)
  }
  if (out.length === 0) throw new Error("hostafrica 解析结果为空(页面结构可能已变化)")
  return out
}

export const hostafricaAdapter = defineAdapter({
  slug: "hostafrica",
  name: "HostAfrica",
  website: "https://hostafrica.co.za",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "ZAR",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["ZAR"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse: parseHostAfrica,
    },
  ],
})