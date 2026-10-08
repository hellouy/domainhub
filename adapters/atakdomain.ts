/**
 * AtakDomain —— 土耳其注册商全量价目(USD 计价)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://atakdomain.com/domain-fiyatlari (SSR 静态表, 907KB)
 * 每行 7 列: [.tld, 分类, Kayıt注册, Yenileme续费, Transfer转移, Geri Alma恢复, Satın Al购买]
 * 币种 USD(页面 $ 计价), 恢复价不入库。
 * 验证: 958 数据行, .com=$6.99/$17.99/$10.99。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://atakdomain.com/domain-fiyatlari"

function numUsd(s: string): number | null {
  const t = s.replace(/[^\d.,]/g, "").trim()
  if (!t) return null
  // 欧式 1.234,56 → 1234.56; 美式 1,234.56 → 1234.56
  let v: number
  if (/^\d{1,3}(\.\d{3})+,\d{2}$/.test(t)) v = Number.parseFloat(t.replace(/\./g, "").replace(",", "."))
  else v = Number.parseFloat(t.replace(/,/g, ""))
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null
}

async function parseAtak(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const rows = raw.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    const cells = (tr.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? []).map((c) => c.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    if (cells.length < 6) continue
    const m = (cells[0] ?? "").match(/^\.?([a-z0-9][a-z0-9-]{0,30}(?:\.[a-z]{2,10})?)$/i)
    if (!m) continue
    const tld = m[1].toLowerCase()
    if (!tld || seen.has(tld)) continue
    const reg = numUsd(cells[2] ?? "")
    const ren = numUsd(cells[3] ?? "")
    const tra = numUsd(cells[4] ?? "")
    if (reg == null && ren == null && tra == null) continue
    const price: RawPrice = { tld, currency: "USD", sourceUrl: URL }
    if (reg != null) price.registerPrice = reg
    if (ren != null) price.renewPrice = ren
    if (tra != null) price.transferPrice = tra
    seen.add(tld)
    out.push(price)
  }
  if (out.length < 500) throw new Error(`atakdomain 解析行数异常: ${out.length}(页面结构可能已变化)`)
  return out
}

export const atakdomainAdapter = defineAdapter({
  slug: "atakdomain",
  name: "AtakDomain",
  website: "https://atakdomain.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["USD"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 90_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse: parseAtak,
    },
  ],
})