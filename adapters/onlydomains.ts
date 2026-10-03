/**
 * OnlyDomains —— 静态价目表(AUD, 单元格数值实体)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.onlydomains.com/domains/pricing
 * 表列: TLD | Country/Type | Min. Term | Price | Renewal | Transfer | Restore*
 * 价格形如 "&#36;13.49"(数值实体), 需解码后解析; 默认币种 AUD。
 * 已验证数百 TLD, AUD/年。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.onlydomains.com/domains/pricing"

async function parseOnlyDomains(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  // 解码数值 HTML 实体(&#36;=$)
  const html = raw.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    const cells = tr.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? []
    if (cells.length < 4) continue
    // TLD 取自首列 anchor：<a href="/domains/...">.ac.nz</a>
    const c0 = cells[0] ?? ""
    const tldM = c0.match(/<a[^>]*href="[^"]*"[^>]*>\s*\.?([a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*)\s*<\/a>/i)
    if (!tldM) continue
    const tld = tldM[1].toLowerCase()
    if (!tld || seen.has(tld)) continue
    const readCell = (c: string): number | null => {
      // 取单元格内 "$X.XX" 形式的价格（忽略整数 aria 副本）
      const m = c.match(/\$(\d{1,3}(?:[.,]\d{1,3})+(?:[.,]\d{1,2})?)/)
      if (!m) return null
      const txt = m[1].replace(/,/g, "")
      const n = Number.parseFloat(txt)
      if (!Number.isFinite(n) || n <= 0) return null
      return Math.round(n * 100) / 100
    }
    // 列: TLD|Country|Min Term|Price|Renewal|Transfer|Restore（用带 $ 前缀的真实价）
    const reg = readCell(cells[3] ?? "")
    const ren = readCell(cells[4] ?? "")
    const tra = readCell(cells[5] ?? "")
    if (reg == null && ren == null && tra == null) continue
    const price: RawPrice = { tld, currency: "AUD", sourceUrl: URL }
    if (reg != null) price.registerPrice = reg
    if (ren != null) price.renewPrice = ren
    if (tra != null) price.transferPrice = tra
    seen.add(tld)
    out.push(price)
  }
  if (out.length === 0) throw new Error("onlydomains 解析结果为空(页面结构可能已变化)")
  return out
}

export const onlydomainsAdapter = defineAdapter({
  slug: "onlydomains",
  name: "OnlyDomains",
  website: "https://www.onlydomains.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "AUD",
  capabilities: { registration: true, renewal: true, transfer: true, restore: true, supportedCurrencies: ["AUD", "EUR", "GBP", "USD"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse: parseOnlyDomains,
    },
  ],
})