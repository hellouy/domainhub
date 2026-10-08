/**
 * ALL Domains (alldomains.uz) —— 乌兹别克注册商价目(UZS)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://alldomains.uz/en/prices (SSR, table#domainTable)
 * 表头: Domain zone | Registration (sum) | Extension (sum) | Recovery (sum) | Transfer (sum)
 * 每行: [". com", "185 000", "185 000", "721 000", "185 000"] (空格千分位)
 * 币种 UZS, 仅注册/续费/转移(恢复列忽略)。价格须去空格后取整。
 * 验证: ~268 TLD, .com 注册 185000 UZS。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://alldomains.uz/en/prices"

function uzs(s: string): number | null {
  const m = s.replace(/[\s,]/g, "").match(/([\d]+(?:\.\d+)?)/)
  if (!m) return null
  const v = Number.parseFloat(m[1])
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null
}

async function parseAlldomains(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const tbl = raw.slice(raw.search(/<table[^>]*id="domainTable"/i))
  const body = tbl.slice(0, tbl.search(/<\/table>/i) + 8)
  const rows = body.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    const cells = (tr.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? []).map((c) => c.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim())
    if (cells.length < 4) continue
    const tld = cells[0].replace(/\s/g, "").replace(/^\./, "").toLowerCase()
    if (!tld || !/^[a-z0-9][a-z0-9.-]*$/.test(tld) || seen.has(tld)) continue
    const reg = uzs(cells[1])
    const ren = uzs(cells[2])
    const tra = uzs(cells[4] ?? "")
    if (reg == null && ren == null && tra == null) continue
    const price: RawPrice = { tld, currency: "UZS", sourceUrl: URL }
    if (reg != null) price.registerPrice = reg
    if (ren != null) price.renewPrice = ren
    if (tra != null) price.transferPrice = tra
    seen.add(tld)
    out.push(price)
  }
  if (out.length < 50) throw new Error(`alldomains 解析行数异常: ${out.length}(页面结构可能已变化)`)
  return out
}

export const alldomainsUzAdapter = defineAdapter({
  slug: "alldomains-uz",
  name: "ALL Domains",
  website: "https://alldomains.uz",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "UZS",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["UZS"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse: parseAlldomains,
    },
  ],
})