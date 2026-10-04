/**
 * Star Domain —— 日本 xserver 系注册商价目(JPY)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://star-domain.jp/price (SSR 静态表)
 * 每行 4 列: [TLD, 新規取得注册, 移管转移, 更新续费], JPY 逗号千分位+円。
 * (ローマ字).jp 取为 .jp 标准行; (日本語).jp 为 IDN 变体跳过。
 * 验证: 57 数据行, .com=980/2,047/2,047。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://star-domain.jp/price"

function numJpy(s: string): number | null {
  const t = s.replace(/[^\d]/g, "")
  if (!t) return null
  const v = Number.parseInt(t, 10)
  return Number.isFinite(v) && v > 0 ? v : null
}

async function parseStarJp(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const rows = raw.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    const cells = (tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []).map((c) => c.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    if (cells.length < 4) continue
    const tldCell = cells[0] ?? ""
    // (ローマ字).jp / (日本語).jp / .com 等格式
    const m = tldCell.match(/\.?([a-z0-9][a-z0-9-]{0,30})$/i)
    if (!m) continue
    const tld = m[1].toLowerCase()
    // IDN 变体(日本語)跳过; ローマ字即标准 .jp
    if (tldCell.includes("日本語")) continue
    if (!tld || seen.has(tld)) continue
    const reg = numJpy(cells[1] ?? "")
    const tra = numJpy(cells[2] ?? "")
    const ren = numJpy(cells[3] ?? "")
    if (reg == null && ren == null && tra == null) continue
    const price: RawPrice = { tld, currency: "JPY", sourceUrl: URL }
    if (reg != null) price.registerPrice = reg
    if (ren != null) price.renewPrice = ren
    if (tra != null) price.transferPrice = tra
    seen.add(tld)
    out.push(price)
  }
  if (out.length < 30) throw new Error(`star-domain 解析行数异常: ${out.length}(页面结构可能已变化)`)
  return out
}

export const starDomainAdapter = defineAdapter({
  slug: "stardomain",
  name: "Star Domain",
  website: "https://star-domain.jp",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "JPY",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["JPY"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse: parseStarJp,
    },
  ],
})