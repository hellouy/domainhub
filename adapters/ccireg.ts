/**
 * CCI Registry (ccireg) —— 注册商指示性价目(USD)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://ccireg.com/Pricing/index.html (SSR 静态表)
 * 每行 5 td: [.tld, 新注册, 续费, 转移, 恢复], 币种 USD。
 * 验证: 12 TLD, .com=$18.00。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://ccireg.com/Pricing/index.html"

function usd(s: string): number | null {
  const m = s.match(/\$?\s*([\d,]+(?:\.\d+)?)/)
  if (!m) return null
  const v = Number.parseFloat(m[1].replace(/,/g, ""))
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null
}

async function parseCcireg(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const rows = raw.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    const cells = (tr.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? []).map((c) => c.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    if (cells.length < 5) continue
    const m = (cells[0] ?? "").match(/^\.([a-z0-9][a-z0-9-]*)$/i)
    if (!m) continue
    const tld = m[1].toLowerCase()
    if (seen.has(tld)) continue
    const reg = usd(cells[1] ?? "")
    const ren = usd(cells[2] ?? "")
    const tra = usd(cells[3] ?? "")
    if (reg == null && ren == null && tra == null) continue
    const price: RawPrice = { tld, currency: "USD", sourceUrl: URL }
    if (reg != null) price.registerPrice = reg
    if (ren != null) price.renewPrice = ren
    if (tra != null) price.transferPrice = tra
    seen.add(tld)
    out.push(price)
  }
  if (out.length < 6) throw new Error(`ccireg 解析行数异常: ${out.length}(页面结构可能已变化)`)
  return out
}

export const cciregAdapter = defineAdapter({
  slug: "ccireg",
  name: "CCI Registry",
  website: "https://ccireg.com",
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
      parse: parseCcireg,
    },
  ],
})