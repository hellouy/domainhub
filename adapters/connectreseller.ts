/**
 * ConnectReseller —— 静态 HTML 价目表（约 650 TLD，多档）
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.connectreseller.com/domain-prices/
 * 表头: TLD | Registration | Renewal | Transfer | Restoration | Offer Validity
 * 价格单元格用数值 HTML 实体（如 &#36;=$），需先解码再按表格解析。
 * 已验证 2026-09-29：.com 等标准价与非促销价一致。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"
import { extractTableRows, defaultNormalize, findTldCell, parsePrice } from "./shared/table-adapter"

async function parseConnectreseller(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const html = raw.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const columnOrder = ["register", "renew", "transfer", "restore", "skip"] as const
  for (const cellsRaw of extractTableRows(html)) {
    const norm = defaultNormalize(cellsRaw)
    const hit = findTldCell(norm)
    if (!hit) continue
    const tld = hit[0]
    if (seen.has(tld)) continue
    const vals: (number | null)[] = []
    for (let i = hit[1] + 1; i < cellsRaw.length; i++) vals.push(parsePrice(cellsRaw[i], "en"))
    if (vals.every((v) => v == null)) continue
    const price: RawPrice = { tld, currency: "USD", sourceUrl: "https://www.connectreseller.com/domain-prices/" }
    let vi = 0
    for (const role of columnOrder) {
      if (vi >= vals.length) break
      const value = vals[vi]
      vi++
      if (role === "skip") continue
      if (role === "register") price.registerPrice = value
      else if (role === "renew") price.renewPrice = value
      else if (role === "transfer") price.transferPrice = value
      else if (role === "restore") price.restorePrice = value
    }
    if (price.registerPrice == null && price.renewPrice == null && price.transferPrice == null) continue
    seen.add(tld)
    out.push(price)
  }
  if (out.length === 0) throw new Error("connectreseller 表格解析结果为空（页面结构可能已变化）")
  return out
}

export const connectresellerAdapter = defineAdapter({
  slug: "connectreseller",
  name: "ConnectReseller",
  website: "https://www.connectreseller.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: true, restore: true, supportedCurrencies: ["USD"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 2, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: "https://www.connectreseller.com/domain-prices/",
      parse: parseConnectreseller,
    },
  ],
})