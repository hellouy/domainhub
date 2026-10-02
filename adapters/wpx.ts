/**
 * WPX —— 页面内嵌 JSON(下单页 products)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://wpx.net/domain-registration/
 * 结构: 内嵌 JSON blob 含 products[], 每条 {name:".com", periods:[{register,transfer,renew}]}
 * 取 periods[0](1 年)的 register/transfer/renew。
 * 已验证约 40 TLD, USD/年。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://wpx.net/domain-registration/"

async function parseWpx(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  // 定位域名 products 数组(下单页配置, 键 "products":[ 且含 periods)
  const start = raw.indexOf('"products":[')
  if (start < 0) throw new Error("wpx 未找到 products 数据")
  const arrStart = raw.indexOf("[", start)
  let depth = 0, inStr = false, esc = false, end = -1
  for (let i = arrStart; i < raw.length; i++) {
    const c = raw[i]
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue }
    if (c === '"') { inStr = true; continue }
    if (c === "[") depth++
    else if (c === "]") { depth--; if (depth === 0) { end = i; break } }
  }
  if (end < 0) throw new Error("wpx 无法定位 products 数组边界")
  const arrStr = raw.slice(arrStart, end + 1)
  let products: any[]
  try {
    products = JSON.parse(arrStr)
  } catch {
    throw new Error("wpx products JSON 解析失败")
  }
  const out: RawPrice[] = []
  const toNum = (v: unknown): number | null => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
  }
  for (const p of products) {
    const tld = String(p?.name ?? "").replace(/^\./, "").toLowerCase()
    if (!tld) continue
    const period = Array.isArray(p?.periods) && p.periods.length ? p.periods[0] : null
    if (!period) continue
    const price: RawPrice = { tld, currency: "USD", sourceUrl: URL }
    const reg = toNum(period.register)
    const tra = toNum(period.transfer)
    const ren = toNum(period.renew)
    if (reg != null) price.registerPrice = reg
    if (tra != null) price.transferPrice = tra
    if (ren != null) price.renewPrice = ren
    if (price.registerPrice == null && price.transferPrice == null && price.renewPrice == null) continue
    out.push(price)
  }
  if (out.length === 0) throw new Error("wpx 解析结果为空(页面结构可能已变化)")
  return out
}

export const wpxAdapter = defineAdapter({
  slug: "wpx",
  name: "WPX.net",
  website: "https://wpx.net",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["USD"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "embedded-json",
      url: URL,
      parse: parseWpx,
    },
  ],
})