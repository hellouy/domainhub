/**
 * WHC (Web Hosting Canada) —— 静态价目行(tld/price/renewprice 属性, CAD)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.whc.ca/domain-names/
 * 结构: <table class="tlds-table"><tr class="tld" tld=".ca" price="10.99" renewprice="C$14.99">
 * 仅 register(price) + renew(renewprice), 无 transfer。
 * 已验证约 441 TLD, CAD/年。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.whc.ca/domain-names/"

async function parseWhc(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const tableMatch = raw.match(/<table[^>]*class="[^"]*tlds-table[^"]*"[^>]*>[\s\S]*?<\/table>/i)
  const scope = tableMatch ? tableMatch[0] : raw
  const tagRe = /<tr\b[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(scope)) !== null) {
    const tag = m[0]
    const tm = tag.match(/tld="\.([^"]+)"/i)
    if (!tm) continue
    const tld = tm[1].toLowerCase()
    if (!tld || seen.has(tld)) continue
    const read = (attr: string): number | null => {
      const mm = tag.match(new RegExp(`${attr}="([\\d.]+)"`, "i"))
      if (!mm) return null
      const n = Number.parseFloat(mm[1])
      return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
    }
    const reg = read("price")
    const ren = read("renewprice")
    if (reg == null && ren == null) continue
    const price: RawPrice = { tld, currency: "CAD", sourceUrl: URL }
    if (reg != null) price.registerPrice = reg
    if (ren != null) price.renewPrice = ren
    seen.add(tld)
    out.push(price)
  }
  if (out.length === 0) throw new Error("whc 解析结果为空(页面结构可能已变化)")
  return out
}

export const whcAdapter = defineAdapter({
  slug: "whc",
  name: "Web Hosting Canada",
  website: "https://www.whc.ca",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "CAD",
  capabilities: { registration: true, renewal: true, supportedCurrencies: ["CAD"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse: parseWhc,
    },
  ],
})