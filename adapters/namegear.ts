/**
 * NameGear —— 日本注册商价目(JPY)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://namegear.co/domain/extensions/ (SSR, 88KB)
 * 每行 5 td: [tld, 注册(多年), 续费(多年), 转移(多年), 恢复(多年)]。
 * 单元格形如 "JPY 2,600 (1 year) JPY 5,200 (2 years) ...", 取 1 year 价。
 * 币种 JPY。
 * 验证: ~20 TLD, .club=2,400/年。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://namegear.co/domain/extensions/"

function year1(s: string): number | null {
  // 优先取 "(1 year)" 前的金额; 退化取首个 JP-金额
  const m = s.match(/(?:JPY|¥|￥)?\s*([\d,]+)\s*\(1\s*year\)/i) || s.match(/(?:JPY|¥|￥)\s*([\d,]+)/i)
  if (!m) return null
  const v = Number.parseInt(m[1].replace(/,/g, ""), 10)
  return Number.isFinite(v) && v > 0 ? v : null
}

async function parseNamegear(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const rows = raw.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    const cells = (tr.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? []).map((c) => c.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    if (cells.length < 4) continue
    const m = (cells[0] ?? "").match(/^\.?([a-z0-9][a-z0-9-]*)$/i)
    if (!m) continue
    const tld = m[1].toLowerCase()
    if (seen.has(tld)) continue
    const reg = year1(cells[1] ?? "")
    const ren = year1(cells[2] ?? "")
    const tra = year1(cells[3] ?? "")
    if (reg == null && ren == null && tra == null) continue
    const price: RawPrice = { tld, currency: "JPY", sourceUrl: URL }
    if (reg != null) price.registerPrice = reg
    if (ren != null) price.renewPrice = ren
    if (tra != null) price.transferPrice = tra
    seen.add(tld)
    out.push(price)
  }
  if (out.length < 8) throw new Error(`namegear 解析行数异常: ${out.length}(页面结构可能已变化)`)
  return out
}

export const namegearAdapter = defineAdapter({
  slug: "namegear",
  name: "NameGear",
  website: "https://namegear.co",
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
      parse: parseNamegear,
    },
  ],
})