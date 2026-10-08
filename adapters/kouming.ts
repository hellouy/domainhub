/**
 * 域名酷盟(kouming) —— 香港注册商价目(USD)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://kouming.com/domain/price (SSR 静态表, 1.2MB)
 * 每行 `<tr data-suffix=".top">`:
 *   td0 suffix_content = .tld
 *   td1 <i class="create">1.60</i> /1年        → 注册
 *   td2 <i class="renewal">6.60</i> /1年        → 续费
 *   td3 <i class="transferenter">4.90</i> /1年  → 转入
 *   td4 <i class="ransom">175.30</i> /1年       → 赎回(忽略)
 * 注册价为首年价, 续费价为本页优惠续费价(页面明示)。
 * 币种 USD(首页续费价标注 "$6.60/1年" 与本站一致; HK 实体, 非 CNY/HKD)。
 * 部分续费显示"抢券"(无数值)须跳过。验证: ~397 TLD, .com 注册 8.60 / 续费 11.57。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://kouming.com/domain/price"

function num(s: string): number | null {
  const m = s.match(/([\d]+(?:\.\d+)?)/)
  if (!m) return null
  const v = Number.parseFloat(m[1])
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null
}

async function parseKouming(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const rows = raw.match(/<tr[^>]*\bdata-suffix="/gi) ? raw.split(/(?=<tr[^>]*\bdata-suffix=)/i) : []
  for (const tr of rows) {
    const tldAttr = (tr.match(/data-suffix="([^"]+)"/) || [])[1]
    if (!tldAttr) continue
    const tld = tldAttr.replace(/^\./, "").trim().toLowerCase()
    if (!tld || !/^[a-z0-9][a-z0-9.-]*$/.test(tld) || seen.has(tld)) continue
    const reg = num((tr.match(/class="create">([^<]*)</) || [])[1] ?? "")
    const ren = num((tr.match(/class="renewal">([^<]*)</) || [])[1] ?? "")
    const tra = num((tr.match(/class="transferenter">([^<]*)</) || [])[1] ?? "")
    if (reg == null && ren == null && tra == null) continue
    const price: RawPrice = { tld, currency: "USD", sourceUrl: URL }
    if (reg != null) price.registerPrice = reg
    if (ren != null) price.renewPrice = ren
    if (tra != null) price.transferPrice = tra
    seen.add(tld)
    out.push(price)
  }
  if (out.length < 100) throw new Error(`kouming 解析行数异常: ${out.length}(页面结构可能已变化)`)
  return out
}

export const koumingAdapter = defineAdapter({
  slug: "kouming",
  name: "域名酷盟",
  website: "https://kouming.com",
  owner: "Data Team",
  version: "1.0.1",
  parserVersion: "1.0.1",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["USD"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse: parseKouming,
    },
  ],
})