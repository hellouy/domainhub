/**
 * NicNames.com —— 公开价目 API(单次返回全量)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: GET https://nicnames.com/api/domains/registrar-prices
 * 响应: registrars[] 每个 {name,currency,ICANNfee,prices:[[tld, reg, renew, transfer], ...]}
 * - 本适配器只取 registrar === "nicnames.com" 的条目(自家价)
 * - tld 无前导点; reg/renew/transfer 为字符串, 空串表示不接受
 * 已验证: .com 11.72/11.72/11.79 USD
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const ENDPOINT = "https://nicnames.com/api/domains/registrar-prices"

async function parseNicnames(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  let data: any
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error("nicnames 响应不是合法 JSON")
  }
  const registrars: any[] = data?.registrars ?? []
  const self = registrars.find((r) => r && String(r.name).toLowerCase() === "nicnames.com")
  if (!self) throw new Error("nicnames 响应缺少 nicnames.com 条目")
  const currency = String(self.currency || "USD").toUpperCase()
  const prices: any[] = Array.isArray(self.prices) ? self.prices : []
  const out: RawPrice[] = []
  const toNum = (s: unknown): number | null => {
    const t = String(s ?? "").trim()
    if (!t) return null
    const n = Number.parseFloat(t)
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
  }
  for (const row of prices) {
    if (!Array.isArray(row) || row.length < 3) continue
    const tld = String(row[0]).trim().replace(/^\./, "")
    if (!tld) continue
    const price: RawPrice = { tld, currency, sourceUrl: ENDPOINT }
    const regN = toNum(row[1])
    const renN = toNum(row[2])
    const traN = toNum(row[3])
    if (regN != null) price.registerPrice = regN
    if (renN != null) price.renewPrice = renN
    if (traN != null) price.transferPrice = traN
    out.push(price)
  }
  if (out.length === 0) throw new Error("nicnames 解析结果为空")
  return out
}

export const nicnamesAdapter = defineAdapter({
  slug: "nicnames",
  name: "NicNames.com",
  website: "https://nicnames.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["USD"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "json",
      url: ENDPOINT,
      parse: parseNicnames,
    },
  ],
})