/**
 * HostAfrica —— 静态价目表(ZAR)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://hostafrica.co.za/domains
 * 结构: Astro 重构后为每组 TLD 一个 tabpanel, 内部 table.dp-panel-table,
 *   head 末列为扩展名(如 ".co.za"), 行 label 为 Register/Transfer/Renewal,
 *   价格 "R49.00"、"Free"(不提供转入 -> null)。
 * 已验证 17 个 TLD, ZAR/年。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://hostafrica.co.za/domains"

function readPrice(txt: string): number | null {
  const t = txt.replace(/<[^>]+>/g, "").trim()
  if (/free/i.test(t) || !t) return null
  const m = t.match(/(\d+(?:\.\d{1,2})?)/)
  if (!m) return null
  const n = Number.parseFloat(m[1])
  return Number.isFinite(n) && n > 1 ? Math.round(n * 100) / 100 : null
}

async function parseHostAfrica(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const panels = raw.match(/<table[^>]*class="dp-panel-table"[\s\S]*?<\/table>/gi) ?? []
  for (const panel of panels) {
    const cells = panel.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []
    if (cells.length < 2) continue
    const tld = (cells[1] ?? "").replace(/<[^>]+>/g, "").replace(/[^a-z0-9.-]/gi, "").trim().toLowerCase().replace(/^\./, "")
    if (!tld || !/^[a-z0-9][a-z0-9-]*(\.[a-z]{2,})?$/.test(tld)) continue
    if (seen.has(tld)) continue
    let reg: number | null = null
    let tra: number | null = null
    let ren: number | null = null
    for (const tr of panel.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
      const th = (tr.match(/<th[^>]*>[\s\S]*?<\/th>/i)?.[0] ?? "").replace(/<[^>]+>/g, "").trim()
      const tds = tr.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? []
      const val = tds.length > 0 ? tds[tds.length - 1].replace(/<[^>]+>/g, "").trim() : ""
      if (/^register/i.test(th)) reg = readPrice(val)
      else if (/^transfer/i.test(th)) tra = readPrice(val)
      else if (/^renewal/i.test(th)) ren = readPrice(val)
    }
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