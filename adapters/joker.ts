/**
 * Joker.com —— 公开 XHR 价目 API(单次返回全量价目表)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: GET https://joker.com/api/v1/price/list
 * 响应: result.pricelist.domains[tld].{registration,renewal,transfer}.total.display_total
 * - tld 为对象键(不含前导点)
 * - display_total 为字符串价格
 * - currency 在 total.currency(小写 usd/eur)
 * 已验证约 598 TLD, 一次请求, 无需鉴权。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const ENDPOINT = "https://joker.com/api/v1/price/list"

async function parseJoker(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  let data: any
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error("joker 响应不是合法 JSON")
  }
  const domains = data?.result?.pricelist?.domains
  if (!domains || typeof domains !== "object") {
    throw new Error("joker 响应缺少 result.pricelist.domains")
  }
  const out: RawPrice[] = []
  for (const [tld, v] of Object.entries<any>(domains)) {
    const reg = v?.registration?.total?.display_total
    const ren = v?.renewal?.total?.display_total
    const tra = v?.transfer?.total?.display_total
    const currencyRaw = v?.registration?.total?.currency || v?.renewal?.total?.currency
    if (reg == null && ren == null && tra == null) continue
    const toNum = (s: unknown): number | null => {
      const n = Number.parseFloat(String(s ?? "").trim())
      return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
    }
    const price: RawPrice = {
      tld,
      currency: String(currencyRaw || "usd").toUpperCase(),
      sourceUrl: ENDPOINT,
    }
    const regN = toNum(reg)
    const renN = toNum(ren)
    const traN = toNum(tra)
    if (regN != null) price.registerPrice = regN
    if (renN != null) price.renewPrice = renN
    if (traN != null) price.transferPrice = traN
    out.push(price)
  }
  if (out.length === 0) throw new Error("joker 解析结果为空")
  return out
}

export const jokerAdapter = defineAdapter({
  slug: "joker",
  name: "Joker.com",
  website: "https://joker.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["USD", "EUR"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "json",
      url: ENDPOINT,
      parse: parseJoker,
    },
  ],
})