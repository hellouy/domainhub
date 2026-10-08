/**
 * 国肇数据(gzidc) —— 中国注册商价目(CNY)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://gzidc.com/domain_new.php (SSR, 50KB)
 * 每行 3 td: [".com英文国际域名", "99元/年", 详情]。TLD 内嵌中文名, 取前导连续点标签(含多级 .com.cn)。
 * 币种 CNY, 仅注册价。0元/年(免费促销)不落库。
 * 验证: ~11 TLD, .com=99元/年。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://gzidc.com/domain_new.php"

function cny(s: string): number | null {
  const m = s.match(/([\d]+(?:\.\d+)?)/)
  if (!m) return null
  const v = Number.parseFloat(m[1])
  return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null
}

async function parseGzidc(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const rows = raw.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    const cells = (tr.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? []).map((c) => c.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    if (cells.length < 2) continue
    const m = (cells[0] ?? "").match(/^((?:\.[a-z0-9-]+)+)/i)
    if (!m) continue
    const tld = m[1].slice(1).toLowerCase()
    if (seen.has(tld)) continue
    const reg = cny(cells[1] ?? "")
    if (reg == null || reg <= 0) continue
    seen.add(tld)
    out.push({ tld, currency: "CNY", sourceUrl: URL, registerPrice: reg })
  }
  if (out.length < 6) throw new Error(`gzidc 解析行数异常: ${out.length}(页面结构可能已变化)`)
  return out
}

export const gzidcAdapter = defineAdapter({
  slug: "gzidc",
  name: "国肇数据 GZIDC",
  website: "https://gzidc.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.1",
  currency: "CNY",
  capabilities: { registration: true, renewal: false, transfer: false, supportedCurrencies: ["CNY"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse: parseGzidc,
    },
  ],
})