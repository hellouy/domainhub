/**
 * Active.domains —— 俄语注册商静态价目表(RUB)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://active.domains/domains/
 * 每行 5 列: [注册商名, .tld, 注册₽, 续费₽, 转移₽]
 * TLD 在 td[1], 价格在 td[2..4](带 ₽ 符号, &nbsp; 千分位)。
 * 覆盖 .ru/.рф/.su 及通用后缀, 币种 RUB。
 * 验证: 解析 107 条(含 .ru/.рf 及 com.ru 等 70 个二级地理后缀), 全含注册价。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://active.domains/domains/"

function rub(s: string): number | null {
  const t = s.replace(/\s|&nbsp;|₽/g, "").replace(/\u00a0/g, "")
  const v = Number.parseFloat(t.replace(",", "."))
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null
}

async function parseActive(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const rows = raw.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    const cells = tr.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? []
    if (cells.length < 5) continue
    const text = (c: string) => c.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
    const tldCell = text(cells[1] ?? "")
    // 多级后缀如 com.ru/msk.su 完整保留
    const m = tldCell.match(/^\.?([a-z0-9\u0430-\u044f][a-z0-9\u0430-\u044f-]*(?:\.[a-z0-9\u0430-\u044f-]+)*)$/i)
    if (!m) continue
    const tld = m[1].toLowerCase()
    if (!tld || seen.has(tld)) continue
    const reg = rub(text(cells[2] ?? ""))
    const ren = rub(text(cells[3] ?? ""))
    const tra = rub(text(cells[4] ?? ""))
    if (reg == null && ren == null && tra == null) continue
    const price: RawPrice = { tld, currency: "RUB", sourceUrl: URL }
    if (reg != null) price.registerPrice = reg
    if (ren != null) price.renewPrice = ren
    if (tra != null) price.transferPrice = tra
    seen.add(tld)
    out.push(price)
  }
  if (out.length === 0) throw new Error("active.domains 解析结果为空(页面结构可能已变化)")
  return out
}

export const activeDomainsAdapter = defineAdapter({
  slug: "activedomains",
  name: "Active.domains",
  website: "https://active.domains",
  owner: "Data Team",
  version: "1.0.1",
  parserVersion: "1.0.1",
  currency: "RUB",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["RUB"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse: parseActive,
    },
  ],
})