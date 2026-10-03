/**
 * Epik —— 公开 XHR 价目 API(单次返回全量)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: GET https://registrar.epik.com/api/load-200-plus-prices
 * 响应: JSON 对象按 tld 键值, 每条含 price/renew/transfer(及 Standard 档)。
 * - 选用 StandardPricing 档(priceStandard/renewStandard/transferStandard)为挂牌价
 * - tld 为键(无前导点)
 * 已验证约 705 TLD, 一次请求, 无需鉴权。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const ENDPOINT = "https://registrar.epik.com/api/load-200-plus-prices"

async function parseEpik(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  let data: any
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error("epik 响应不是合法 JSON")
  }
  const out: RawPrice[] = []
  const toNum = (s: unknown): number | null => {
    const t = String(s ?? "").trim()
    if (!t) return null
    const n = Number.parseFloat(t)
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
  }
  for (const [tld, v] of Object.entries<any>(data || {})) {
    if (!v || typeof v !== "object") continue
    const record = v
    const regN = toNum(record.priceStandard ?? record.price)
    const renN = toNum(record.renewStandard ?? record.renew)
    const traN = toNum(record.transferStandard ?? record.transfer)
    if (regN == null && renN == null && traN == null) continue
    const price: RawPrice = { tld, currency: "USD", sourceUrl: ENDPOINT }
    if (regN != null) price.registerPrice = regN
    if (renN != null) price.renewPrice = renN
    if (traN != null) price.transferPrice = traN
    out.push(price)
  }
  if (out.length === 0) throw new Error("epik 解析结果为空")
  return out
}

export const epikAdapter = defineAdapter({
  slug: "epik",
  name: "Epik",
  website: "https://www.epik.com",
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
      parse: parseEpik,
    },
  ],
})