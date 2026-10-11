/**
 * WhoGoHost —— 尼日利亚本地注册商, 静态价目表(NGN)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.whogohost.com/domain/
 * 结构: <table><tr><td>.tld</td><td>₦reg</td><td>₦renew</td><td>₦transfer</td><td><a>Register</a></td></tr>
 * 已验证 ~270 TLD, NGN/年 三价齐全。
 * 关键价值: .ng/.com.ng/.name.ng 等尼日利亚国别域名, 当前其他注册商不卖。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.whogohost.com/domain/"

async function parseWhoGoHost(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const rows = raw.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    if (/<th[ >]/i.test(tr)) continue
    const cells = tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []
    if (cells.length < 4) continue
    const tld = (cells[0] ?? "").replace(/<[^>]+>/g, "").replace(/[^a-z0-9.-]/gi, "").trim().toLowerCase().replace(/^\./, "")
    if (!tld || !/^[a-z0-9][a-z0-9-]*(\.[a-z]{2,})?$/.test(tld)) continue
    if (seen.has(tld)) continue
    const read = (c: string): number | null => {
      const t = c.replace(/<[^>]+>/g, "").replace(/[^\d.\s]/g, "").trim()
      if (!t) return null
      const n = Number.parseFloat(t.replace(/\s/g, ""))
      if (!Number.isFinite(n) || n <= 0) return null
      return Math.round(n * 100) / 100
    }
    const reg = read(cells[1])
    const ren = read(cells[2])
    const tra = read(cells[3])
    if (reg == null && ren == null && tra == null) continue
    const price: RawPrice = { tld, currency: "NGN", sourceUrl: URL }
    if (reg != null) price.registerPrice = reg
    if (ren != null) price.renewPrice = ren
    if (tra != null) price.transferPrice = tra
    seen.add(tld)
    out.push(price)
  }
  if (out.length === 0) throw new Error("whogohost 解析结果为空(页面结构可能已变化)")
  return out
}

export const whogohostAdapter = defineAdapter({
  slug: "whogohost",
  name: "WhoGoHost",
  website: "https://www.whogohost.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "NGN",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["NGN"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse: parseWhoGoHost,
    },
  ],
})
