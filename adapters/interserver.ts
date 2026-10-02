/**
 * Interserver —— 服务端渲染的价格链接行(data-tld + 3 个 tld-cost)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.interserver.net/domains/
 * 结构: <a class="tld-item tld-row" data-tld=".org">
 *         <span class="tld-name">.org</span>
 *         <span class="tld-cost">$13</span>    (register)
 *         <span class="tld-cost">$14.31</span> (renew)
 *         <span class="tld-cost">$14.31</span> (transfer)
 *       </a>
 * 已验证约 561 TLD, USD/年。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.interserver.net/domains/"

async function parseInterServer(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const anchors = raw.match(/<a\b[^>]*class="[^"]*tld-item tld-row"[^>]*>[\s\S]*?<\/a>/gi) ?? []
  for (const a of anchors) {
    const tldMatch = a.match(/data-tld="\.([a-z0-9\u00e0-\uffff-]+)"/i)
    if (!tldMatch) continue
    const tld = tldMatch[1].toLowerCase()
    const costs = a.match(/<span class="tld-cost">[^<]*<\/span>/gi) ?? []
    if (costs.length < 3) continue
    const read = (s: string): number | null => {
      const m = s.replace(/<[^>]+>/g, "").replace(/[^\d.\s]/g, "").trim()
      if (!m) return null
      const n = Number.parseFloat(m.replace(/\s/g, ""))
      return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
    }
    const reg = read(costs[0] ?? "")
    const ren = read(costs[1] ?? "")
    const tra = read(costs[2] ?? "")
    if (reg == null && ren == null && tra == null) continue
    if (seen.has(tld)) continue
    seen.add(tld)
    const price: RawPrice = { tld, currency: "USD", sourceUrl: URL }
    if (reg != null) price.registerPrice = reg
    if (ren != null) price.renewPrice = ren
    if (tra != null) price.transferPrice = tra
    out.push(price)
  }
  if (out.length === 0) throw new Error("interserver 解析结果为空(页面结构可能已变化)")
  return out
}

export const interserverAdapter = defineAdapter({
  slug: "interserver",
  name: "InterServer",
  website: "https://www.interserver.net",
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
      parse: parseInterServer,
    },
  ],
})