/**
 * Vsys (vsys.name) —— 注册商价目(USD)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://vsys.name/pricing (SSR 静态表)
 * 每行 <tr class="pricing-table__table-row">:
 *   td0 = .tld (内含分类 span, 忽略)
 *   td1 = Domain Privacy 可用性(忽略)
 *   td2 = <span class="price" data-price="16.00">$16.00</span> /yr  → 注册
 *   td3 = Restore $80.00 (忽略)
 * 币种 USD, 仅注册价。验证: ~385 TLD, .com 注册 $16.00。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://vsys.name/pricing"

async function parseVsys(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const rows = raw.match(/<tr[^>]*pricing-table__table-row[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    const tld = ((tr.match(/pricing-table__table-position"[^>]*>\s*([^<\s]+)/) || [])[1] ?? "").replace(/^\./, "").trim().toLowerCase()
    if (!tld || !/^[a-z0-9][a-z0-9.-]*$/.test(tld) || seen.has(tld)) continue
    const regStr = (tr.match(/data-price="([\d.]+)"/) || [])[1] ?? (tr.match(/class="price"[^>]*>\s*\$?\s*([\d.,]+)/) || [])[1] ?? ""
    const v = Number.parseFloat(regStr.replace(/,/g, ""))
    if (!Number.isFinite(v) || v <= 0) continue
    seen.add(tld)
    out.push({ tld, currency: "USD", sourceUrl: URL, registerPrice: Math.round(v * 100) / 100 })
  }
  if (out.length < 50) throw new Error(`vsys 解析行数异常: ${out.length}(页面结构可能已变化)`)
  return out
}

export const vsysAdapter = defineAdapter({
  slug: "vsys",
  name: "Vsys",
  website: "https://vsys.name",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  capabilities: { registration: true, renewal: false, transfer: false, supportedCurrencies: ["USD"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse: parseVsys,
    },
  ],
})