/**
 * One.com —— 公开 REST API(每 TLD 单请求)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 列表: GET https://www.one.com/rest/tlds/popular/?country=GB
 *       → result.tlds (20 个, 带前导点)
 * 单价: GET https://www.one.com/rest/tlds/<.tld>/display-prices/?country=GB
 *       → fullPriceExclCurrencyAsString(挂牌/注册价)
 * 注意: 每 TLD 一次请求; 无续费/转入价; 币种符号 £(固定 country=GB)。
 * 已验证 .com 7.99(促销)~21.99(挂牌), 取 fullPrice。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const COUNTRY = "GB"
const LIST_URL = `https://www.one.com/rest/tlds/popular/?country=${COUNTRY}`
const UA = "Mozilla/5.0 AppleWebKit/537.36 Chrome/124 Safari/537.36"

async function parseOne(raw: string, ctx: AdapterContext): Promise<RawPrice[]> {
  let list: any
  try {
    list = JSON.parse(raw)
  } catch {
    throw new Error("one.com 列表响应不是合法 JSON")
  }
  const tlds: string[] = Array.isArray(list?.result?.tlds) ? list.result.tlds : []
  if (tlds.length === 0) throw new Error("one.com 列表为空")
  const out: RawPrice[] = []
  for (const dotTld of tlds) {
    const tld = String(dotTld).replace(/^\./, "").toLowerCase()
    if (!tld) continue
    try {
      const url = `https://www.one.com/rest/tlds/${encodeURIComponent(dotTld)}/display-prices/?country=${COUNTRY}`
      const res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/json" }, signal: AbortSignal.timeout(20000) })
      if (!res.ok) continue
      const j = await res.json().catch(() => null)
      const full = j?.fullPriceExclCurrencyAsString
      if (full == null) continue
      const n = Number.parseFloat(String(full).trim())
      if (!Number.isFinite(n) || n <= 0) continue
      out.push({ tld, currency: "GBP", registerPrice: Math.round(n * 100) / 100, sourceUrl: url })
    } catch {
      // 单个 TLD 请求失败则跳过, 不影响其余
    }
  }
  if (out.length === 0) throw new Error("one.com 解析结果为空")
  return out
}

export const oneAdapter = defineAdapter({
  slug: "one",
  name: "One.com",
  website: "https://www.one.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "GBP",
  capabilities: { registration: true, supportedCurrencies: ["GBP", "EUR", "USD", "HKD"] },
  rateLimit: { concurrency: 2, rpm: 30, retries: 2, timeoutMs: 60_000 },
  strategies: [
    {
      type: "api",
      url: LIST_URL,
      parse: parseOne,
    },
  ],
})