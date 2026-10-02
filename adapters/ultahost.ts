/**
 * UltraHost —— 静态价目行(data-usd 属性 + 标签)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://ultahost.com/en/domains/pricing
 * 表: #domainDataTble, 每行 <td>TLD</td> + 4 个价目格,
 *   每格含 label(Register/Renew/Transfer/Redemption) + span.package-price-js data-usd。
 * 取 data-usd 数值(USD), 按 label 映射列。
 * 已验证约 664 TLD, USD/年。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://ultahost.com/en/domains/pricing"

async function parseUltrahost(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const tableMatch = raw.match(/<table[^>]*id="domainDataTble"[^>]*>[\s\S]*?<\/table>/i)
  const scope = tableMatch ? tableMatch[0] : raw
  // 站点行 <tr> 未闭合: 以 <tr 标签边界切分行
  const rowSegs = scope.split(/<tr\b[^>]*>/i).slice(1)
  for (const seg of rowSegs) {
    const cells = seg.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? []
    if (cells.length < 2) continue
    // TLD: td[0] > a > span.main.fw-500
    const tldM = (cells[0] ?? "").match(/<span class="main fw-500"[^>]*>\s*\.([a-z0-9\u00e0-\uffff-]+)\s*<\/span>/i)
    if (!tldM) continue
    const tld = tldM[1].toLowerCase()
    if (seen.has(tld)) continue
    const price: RawPrice = { tld, currency: "USD", sourceUrl: URL }
    let hasAny = false
    for (const cell of cells.slice(1)) {
      const labelM = cell.match(/<span class="text-muted fs-12 mb-2 d-block">\s*([^<]+?)\s*<\/span>/i)
      const usdM = cell.match(/data-usd="([\d.,]+)"/)
      if (!labelM || !usdM) continue
      const label = labelM[1].trim().toLowerCase()
      const num = Number.parseFloat(String(usdM[1]).replace(/,/g, ""))
      if (!Number.isFinite(num) || num <= 0) continue
      const v = Math.round(num * 100) / 100
      if (label === "register") { price.registerPrice = v; hasAny = true }
      else if (label === "renew") { price.renewPrice = v; hasAny = true }
      else if (label === "transfer") { price.transferPrice = v; hasAny = true }
      else if (label === "redemption") { price.restorePrice = v; hasAny = true }
    }
    if (!hasAny) continue
    seen.add(tld)
    out.push(price)
  }
  if (out.length === 0) throw new Error("ultahost 解析结果为空(页面结构可能已变化)")
  return out
}

export const ultahostAdapter = defineAdapter({
  slug: "ultahost",
  name: "UltraHost",
  website: "https://ultahost.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: true, restore: true, supportedCurrencies: ["USD", "EUR"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse: parseUltrahost,
    },
  ],
})