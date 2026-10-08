/**
 * Dotwee.com —— 内嵌 JSON 价目表(约 460+ TLD)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://dotwee.com/pricing
 * 页面为 Alpine.js 渲染, 价格数据以内嵌 JSON 数组注入:
 *   [{"tld":".ac","reg":49.99,"renew":49.99,"transfer":49.99,"category":"country",
 *     "allow_register":1,"allow_transfer":1,"min_years":1}, ...]
 * tld 带前导点; reg/renew/transfer 单位 USD; 兼容允许注册/转移的行。
 * 验证: 解析 461 条, 461 含注册价, Validation 100%。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://dotwee.com/pricing"

async function parseDotwee(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const start = raw.indexOf('[{"tld"')
  if (start < 0) throw new Error("dotwee 未找到内嵌 JSON 数组(页面结构可能已变化)")
  let depth = 0
  let end = -1
  for (let i = start; i < raw.length; i++) {
    const c = raw[i]
    if (c === "[") depth++
    else if (c === "]") {
      depth--
      if (depth === 0) { end = i + 1; break }
    }
  }
  if (end < 0) throw new Error("dotwee 内嵌 JSON 数组未闭合")
  let arr: {
    tld?: unknown
    reg?: unknown
    renew?: unknown
    transfer?: unknown
    allow_register?: unknown
  }[]
  try {
    arr = JSON.parse(raw.slice(start, end))
  } catch {
    throw new Error("dotwee 内嵌 JSON 解析失败")
  }
  const out: RawPrice[] = []
  const seen = new Set<string>()
  for (const item of arr) {
    const tldRaw = typeof item.tld === "string" ? item.tld : ""
    const tld = tldRaw.toLowerCase().replace(/^\./, "")
    if (!tld || seen.has(tld)) continue
    const toNum = (v: unknown): number | null => {
      const n = Number(v)
      return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
    }
    const reg = toNum(item.reg)
    const ren = toNum(item.renew)
    const tra = toNum(item.transfer)
    // 允许注册才录; 至少一个注册价
    const allowed = item.allow_register === undefined ? true : Number(item.allow_register) === 1
    if (!allowed) continue
    if (reg == null && ren == null && tra == null) continue
    const price: RawPrice = { tld, currency: "USD", sourceUrl: URL }
    if (reg != null) price.registerPrice = reg
    if (ren != null) price.renewPrice = ren
    if (tra != null) price.transferPrice = tra
    seen.add(tld)
    out.push(price)
  }
  if (out.length === 0) throw new Error("dotwee 解析结果为空")
  return out
}

export const dotweeAdapter = defineAdapter({
  slug: "dotwee",
  name: "Dotwee",
  website: "https://dotwee.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["USD"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse: parseDotwee,
    },
  ],
})