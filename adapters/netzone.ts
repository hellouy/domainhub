/**
 * NetZone —— 瑞士注册商全量价目(USD)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://netzone.ch/de/domainregistrierung (SSR, 274KB)
 * 每行 4 td: [.tld, 国家, 注册价(含首年), 续费价/年], 币种 USD(页首声明 exkl. MwSt.)。
 * 页面含"Beliebte Domains"重复段, 按 tld 去重保留首见。
 * 验证: ~1019 唯一 TLD, 含 co.uk/com.br 等二级后缀。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://netzone.ch/de/domainregistrierung"

function num(s: string): number | null {
  const m = s.replace(/\s/g, "").match(/([\d]+(?:[.,]\d+)?)/)
  if (!m) return null
  const v = Number.parseFloat(m[1].replace(",", "."))
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null
}

async function parseNetzone(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const rows = raw.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    const cells = (tr.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? []).map((c) => c.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    if (cells.length !== 4) continue
    const m = (cells[0] ?? "").match(/^\.([a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*)$/i)
    if (!m) continue
    const tld = m[1].toLowerCase()
    if (seen.has(tld)) continue
    const reg = num(cells[2] ?? "")
    const ren = num(cells[3] ?? "")
    if (reg == null && ren == null) continue
    const price: RawPrice = { tld, currency: "USD", sourceUrl: URL }
    if (reg != null) price.registerPrice = reg
    if (ren != null) price.renewPrice = ren
    seen.add(tld)
    out.push(price)
  }
  if (out.length < 500) throw new Error(`netzone 解析行数异常: ${out.length}(页面结构可能已变化)`)
  return out
}

export const netzoneAdapter = defineAdapter({
  slug: "netzone",
  name: "NetZone",
  website: "https://netzone.ch",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: false, supportedCurrencies: ["USD"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse: parseNetzone,
    },
  ],
})