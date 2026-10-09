/**
 * Metaname —— 分档价目表(注册价 + 续费价, NZD)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://metaname.net/public/pricing
 * 表: 表头 TLD | 0-15 | 16-127 | 128-511 | 512-1023 | 1024+ (按持有量分档)
 * 每个单元格含两个金额: 首值为注册价, 次值为续费价(如 ".nz $38.50 $44.27")。
 * 注册/续费取 0-15 档(标准个人持有量)。
 * 已验证约 90+ TLD, NZD/年, 无转入价。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://metaname.net/public/pricing"

function parsePrice(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(/[^0-9.]/g, ""))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

async function parseMetaname(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const rows = raw.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    const cells = tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []
    if (cells.length < 2) continue
    const tldCell = (cells[0] ?? "").replace(/<[^>]+>/g, "").trim()
    const tld = tldCell.toLowerCase().replace(/^\./, "")
    if (!/^[a-z0-9-]{2,}$/.test(tld) || seen.has(tld)) continue

    // 0-15 档(第一价档)为首个数字单元格, 含两个金额: 注册价 + 续费价
    const cellText = (cells[1] ?? "").replace(/<[^>]+>/g, " ").trim()
    const nums = cellText.match(/\$?\s?([\d.]+)/g) ?? []
    if (nums.length === 0) continue
    const registerPrice = parsePrice(nums[0] ?? "")
    const renewPrice = nums.length > 1 ? parsePrice(nums[1] ?? "") : null
    if (registerPrice == null) continue

    seen.add(tld)
    const price: RawPrice = { tld, currency: "NZD", sourceUrl: URL }
    if (registerPrice != null) price.registerPrice = registerPrice
    if (renewPrice != null) price.renewPrice = renewPrice
    out.push(price)
  }
  if (out.length === 0) throw new Error("metaname 解析结果为空(页面结构可能已变化)")
  return out
}

export const metanameAdapter = defineAdapter({
  slug: "metaname",
  name: "Metaname",
  website: "https://metaname.net",
  owner: "Data Team",
  version: "2.0.0",
  parserVersion: "1.0.0",
  currency: "NZD",
  capabilities: { registration: true, renewal: true, supportedCurrencies: ["NZD"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse: parseMetaname,
    },
  ],
})
