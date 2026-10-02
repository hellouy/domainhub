/**
 * iwantmyname —— 公开价目 API(分页, 单次全量)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: GET https://iwantmyname.com/Prices-getPrices.html?ajax=1&limit=500&offset=0&level=IWMN&currency=USD
 * 响应: rows 按 tld 键值, 每条含 registration.price / renewal.price / transfer.price
 * 已验证约 668 TLD, USD/年。分页 fetch 需翻页(每页 limit)。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const LEVEL = "IWMN"
const LIMIT = 500
const CURRENCY = "USD"

async function iwmFetch(ctx: AdapterContext): Promise<string> {
  let out: Record<string, any> = {}
  let offset = 0
  for (;;) {
    const url = `https://iwantmyname.com/Prices-getPrices.html?ajax=1&limit=${LIMIT}&offset=${offset}&level=${LEVEL}&currency=${CURRENCY}`
    const res = await ctx.fetch(url, { headers: { "X-Requested-With": "XMLHttpRequest", "Accept-Language": "en-US,en;q=0.9" } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const j = await res.json().catch(() => null)
    const rows = j?.rows
    if (!rows || typeof rows !== "object") break
    Object.assign(out, rows)
    const total = Number(j?.totalRows ?? 0)
    const got = Object.keys(rows).length
    if (got === 0 || (total > 0 && offset + got >= total)) break
    offset += got
  }
  if (Object.keys(out).length === 0) throw new Error("iwantmyname 响应为空")
  return JSON.stringify(out)
}

async function parseIwm(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  let rows: Record<string, any>
  try {
    rows = JSON.parse(raw)
  } catch {
    throw new Error("iwantmyname 响应不是合法 JSON")
  }
  const out: RawPrice[] = []
  const toNum = (s: unknown): number | null => {
    const t = String(s ?? "").trim()
    if (!t) return null
    const n = Number.parseFloat(t)
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
  }
  for (const [tld, v] of Object.entries<any>(rows)) {
    const reg = toNum(v?.registration?.price)
    const ren = toNum(v?.renewal?.price)
    const tra = toNum(v?.transfer?.price)
    if (reg == null && ren == null && tra == null) continue
    const price: RawPrice = { tld, currency: CURRENCY, sourceUrl: "https://iwantmyname.com/domains/" }
    if (reg != null) price.registerPrice = reg
    if (ren != null) price.renewPrice = ren
    if (tra != null) price.transferPrice = tra
    out.push(price)
  }
  if (out.length === 0) throw new Error("iwantmyname 解析结果为空")
  return out
}

export const iwantmynameAdapter = defineAdapter({
  slug: "iwantmyname",
  name: "iwantmyname",
  website: "https://iwantmyname.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: CURRENCY,
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["USD", "GBP", "EUR", "AUD"] },
  rateLimit: { concurrency: 1, rpm: 15, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "api",
      url: `https://iwantmyname.com/Prices-getPrices.html?ajax=1&limit=${LIMIT}&offset=0&level=${LEVEL}&currency=${CURRENCY}`,
      fetch: iwmFetch,
      parse: parseIwm,
    },
  ],
})