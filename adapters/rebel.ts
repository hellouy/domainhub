/**
 * Rebel.com —— 公开零售定价 API
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: GET https://api.rebel.com/price/allTLDPrices/Rebel
 *     （rebel.com/domains/pricing 页面 XHR 发现，公开无鉴权，Tucows 零售品牌）
 * 响应: { prices: [{ name, prices: { USD: {Price, Reg, Ren, Bo}, CAD: {...} } }] }
 *   - Reg = 标准注册价, Ren = 续费价, Price = 当前售价（低于 Reg 时为首年促销价）
 * 已验证 471 TLD 全量（USD+CAD 双币种，此处取 USD），全部含注册+续费价。
 * 多级后缀用下划线命名且顺序不统一（uk_co→co.uk 但 com_it→com.it），显式映射；
 * com_it 在响应中重复两次（价格一致），按 TLD 去重。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const API_URL = "https://api.rebel.com/price/allTLDPrices/Rebel"
const SOURCE_URL = "https://www.rebel.com/domains/pricing"

/** API 下划线名 → 标准多级后缀 */
const MULTI_LEVEL_MAP: Record<string, string> = {
  au_asn: "asn.au",
  au_com: "com.au",
  au_id: "id.au",
  au_net: "net.au",
  au_org: "org.au",
  com_it: "com.it",
  nz_co: "co.nz",
  uk_co: "co.uk",
}

async function rebelFetch(ctx: AdapterContext): Promise<string> {
  const res = await ctx.fetch(API_URL, { headers: { Accept: "application/json" } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = await res.json().catch(() => null)
  if (!j?.prices || !Array.isArray(j.prices) || j.prices.length === 0) {
    throw new Error("rebel 响应为空或结构异常")
  }
  return JSON.stringify(j)
}

function parseRebel(raw: string, _ctx: AdapterContext): RawPrice[] {
  let j: { prices?: Array<Record<string, any>> }
  try {
    j = JSON.parse(raw)
  } catch {
    throw new Error("rebel 响应不是合法 JSON")
  }
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const toNum = (v: unknown): number | null => {
    const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""))
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
  }
  for (const entry of j.prices ?? []) {
    const rawName = String(entry?.name ?? "").trim().toLowerCase()
    if (!rawName) continue
    const tld = MULTI_LEVEL_MAP[rawName] ?? rawName
    if (seen.has(tld)) continue
    const usd = entry?.prices?.USD
    const reg = toNum(usd?.Reg)
    const ren = toNum(usd?.Ren)
    const cur = toNum(usd?.Price)
    if (reg == null && ren == null) continue
    seen.add(tld)
    const price: RawPrice = { tld, currency: "USD", sourceUrl: SOURCE_URL }
    if (reg != null) price.registerPrice = reg
    if (ren != null) price.renewPrice = ren
    if (cur != null && reg != null && cur < reg) price.promotionPrice = cur
    out.push(price)
  }
  if (out.length === 0) throw new Error("rebel 解析结果为空")
  return out
}

export const rebelAdapter = defineAdapter({
  slug: "rebel",
  name: "Rebel.com",
  website: "https://www.rebel.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: false, supportedCurrencies: ["USD", "CAD"] },
  rateLimit: { concurrency: 1, rpm: 15, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "api",
      url: API_URL,
      fetch: rebelFetch,
      parse: parseRebel,
    },
  ],
})
