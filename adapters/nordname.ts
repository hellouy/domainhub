/**
 * NordName (nordname.com) —— 域名价格列表
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: GET https://nordname.com/data/tld-prices.json
 * 结构: 数组 [{ tld, registration, transfer, renewal, registrationSepa, ... }]
 * 价格: 一年期，USD。registrationWas 为原价（存在时表示促销）
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const DATA_URL = "https://nordname.com/data/tld-prices.json"
const SOURCE = "https://nordname.com/domains#prices"

function toNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

async function nordnameFetch(ctx: AdapterContext): Promise<string> {
  const res = await ctx.fetch(DATA_URL, {
    headers: { "Accept": "application/json", "Accept-Language": "en-US,en;q=0.9" },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  if (!text.trim()) throw new Error("nordname 响应为空")
  return text
}

async function parseNordname(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  let rows: any
  try {
    rows = JSON.parse(raw)
  } catch {
    throw new Error("nordname 响应不是合法 JSON")
  }
  if (!Array.isArray(rows)) throw new Error("nordname 数据结构异常")

  const out: RawPrice[] = []
  const seen = new Set<string>()

  for (const it of rows) {
    const tld = String(it?.tld ?? "").replace(/^\./, "").toLowerCase()
    if (!tld || seen.has(tld) || !/^[a-z0-9-]{2,}$/.test(tld)) continue
    seen.add(tld)

    const reg = toNum(it?.registration)
    const ren = toNum(it?.renewal)
    const trf = toNum(it?.transfer)
    if (reg == null && ren == null && trf == null) continue

    const price: RawPrice = { tld, currency: "USD", sourceUrl: SOURCE }
    if (reg != null) price.registerPrice = reg
    if (ren != null) price.renewPrice = ren
    if (trf != null) price.transferPrice = trf

    // registrationWas 存在且高于现价 => 促销价，原价存 promotionPrice
    const was = toNum(it?.registrationWas)
    if (was != null && reg != null && was > reg) price.promotionPrice = was

    out.push(price)
  }

  if (out.length === 0) throw new Error("nordname 解析结果为空")
  return out
}

export const nordnameAdapter = defineAdapter({
  slug: "nordname",
  name: "NordName",
  website: "https://nordname.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    supportedCurrencies: ["USD"],
    supportedLanguages: ["en", "fi", "sv", "pl"],
  },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "api",
      url: DATA_URL,
      fetch: nordnameFetch,
      parse: parseNordname,
    },
  ],
})