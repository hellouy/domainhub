/**
 * GateHills —— 新加坡系注册商全量价目 + 首年促销(USD)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://gatehills.com/domain-prices-transparent-registration-renewal (SSR, 1.4MB)
 * 每行 7 td: [.tld, 分类, NewPrice, Transfer, Renewal, Grace, Redemption]
 * NewPrice 单元格含两个 div: line-through=标准注册价, text-red-500=促销价(首年)。
 * 部分行仅单一价格(多为二级后缀如 org.ae)。价格格式 "USD 19.20 1 Year"。
 * 验证: 435 数据行, 264 行含促销, .biz 19.20→7.50。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://gatehills.com/domain-prices-transparent-registration-renewal"

function numUsd(s: string): number | null {
  const m = s.match(/USD\s?\$?([\d,]+(?:\.\d+)?)/)
  if (!m) return null
  const v = Number.parseFloat(m[1].replace(/,/g, ""))
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null
}

async function parseGatehills(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const rows = raw.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    const cells = tr.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? []
    if (cells.length < 5) continue
    const tldCell = (cells[0] ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
    const m = tldCell.match(/^\.?([a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*)$/i)
    if (!m) continue
    const tld = m[1].toLowerCase()
    if (!tld || seen.has(tld)) continue
    const newCell = cells[2] ?? ""
    const original = newCell.includes("line-through") ? numUsd(newCell.match(/line-through[\s\S]{0,200}/)?.[0] ?? "") : null
    const promo = newCell.includes("text-red-500") ? numUsd(newCell.match(/text-red-500[\s\S]{0,200}/)?.[0] ?? "") : null
    const single = original == null && promo == null ? numUsd(newCell) : null
    const reg = original ?? single
    const tra = numUsd(cells[3] ?? "")
    const ren = numUsd(cells[4] ?? "")
    if (reg == null && tra == null && ren == null) continue
    const price: RawPrice = { tld, currency: "USD", sourceUrl: URL }
    if (reg != null) price.registerPrice = reg
    if (tra != null) price.transferPrice = tra
    if (ren != null) price.renewPrice = ren
    if (promo != null && reg != null && promo < reg) price.promotionPrice = promo
    seen.add(tld)
    out.push(price)
  }
  if (out.length < 300) throw new Error(`gatehills 解析行数异常: ${out.length}(页面结构可能已变化)`)
  return out
}

export const gatehillsAdapter = defineAdapter({
  slug: "gatehills",
  name: "GateHills",
  website: "https://gatehills.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["USD"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 120_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse: parseGatehills,
    },
  ],
})