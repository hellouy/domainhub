/**
 * Cosmotown —— 注册商价目(USD)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://cosmotown.com/pricing (AngularJS 客户端渲染, 裸 HTML 无价表)
 * 表头: TLD | Registration | Renewal | Transfer
 * 行(渲染后): <tr ng-repeat=...><td>.com</td><td>$8.59</td><td>$11.35</td><td>$11.35</td></tr>
 * 币种 USD。因依赖 JS, 首选 html 策略(供未来 SSR), 失败降级 playwright 渲染后解析。
 * 验证: ~250 TLD, .com 注册 $8.59 / 续费 $11.35。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://cosmotown.com/pricing"

function usd(s: string): number | null {
  const m = s.replace(/,/g, "").match(/\$?\s*([\d]+(?:\.\d+)?)/)
  if (!m) return null
  const v = Number.parseFloat(m[1])
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null
}

async function parseCosmotown(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const rows = raw.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    const cells = (tr.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? []).map((c) => c.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim())
    if (cells.length < 4) continue
    const tld = (cells[0] ?? "").replace(/^\./, "").trim().toLowerCase()
    if (!tld || !/^[a-z0-9][a-z0-9.-]*$/.test(tld) || seen.has(tld)) continue
    const reg = usd(cells[1] ?? "")
    const ren = usd(cells[2] ?? "")
    const tra = usd(cells[3] ?? "")
    if (reg == null && ren == null && tra == null) continue
    const price: RawPrice = { tld, currency: "USD", sourceUrl: URL }
    if (reg != null) price.registerPrice = reg
    if (ren != null) price.renewPrice = ren
    if (tra != null) price.transferPrice = tra
    seen.add(tld)
    out.push(price)
  }
  if (out.length < 50) throw new Error(`cosmotown 解析行数异常: ${out.length}(页面结构可能已变化)`)
  return out
}

export const cosmotownAdapter = defineAdapter({
  slug: "cosmotown",
  name: "Cosmotown",
  website: "https://cosmotown.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["USD"] },
  rateLimit: { concurrency: 1, rpm: 8, retries: 2, timeoutMs: 90_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse: parseCosmotown,
    },
    {
      type: "playwright",
      url: URL,
      browser: { extract: "html", waitFor: ".ng-binding", waitForTimeoutMs: 25_000, scrollToBottom: true, locale: "en-US" },
      parse: parseCosmotown,
    },
  ],
})