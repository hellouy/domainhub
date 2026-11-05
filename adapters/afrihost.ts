/**
 * Afrihost —— 南非本地注册商, Nuxt 页面价格(ZAR)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.afrihost.com/domains
 * 结构: Nuxt 3 SSR, 价格数据在 <script id="__NUXT_DATA__"> 内嵌 devalue 扁平数组,
 *       对象条目 {name,price,renew_cost,transfer_cost,parking_cost} 值为字符串表索引。
 * 2026-11-05 改为 html 策略直连解析 __NUXT_DATA__, 无需浏览器舰队;
 *       playwright extract html 仅作直连被拦兜底。
 * 已验证 138 TLD; co.za/net.za/org.za 等 transfer=0 (免费转入)。
 * 特色: .africa/.durban/.joburg/.co.za/.mu 等非洲 ccTLD 与南非本地域名
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.afrihost.com/domains"

function toPrice(s: string): number | null {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : null
}

function extractNuxtPrices(raw: string): RawPrice[] {
  const dataMatch = raw.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
  if (!dataMatch) throw new Error("afrihost 未找到 __NUXT_DATA__ 内嵌数据(页面结构可能已变化)")
  let arr: unknown
  try {
    arr = JSON.parse(dataMatch[1])
  } catch {
    throw new Error("afrihost __NUXT_DATA__ payload 不是合法 JSON(页面结构可能已变化)")
  }
  if (!Array.isArray(arr)) throw new Error("afrihost __NUXT_DATA__ 结构异常(页面结构可能已变化)")
  const list = arr as unknown[]
  const deref = (v: unknown): unknown => {
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v >= list.length) return v
    const s = list[v]
    return typeof s === "string" ? s : v
  }
  const found: Array<Record<string, unknown>> = []
  for (const e of list) {
    if (e != null && typeof e === "object" && !Array.isArray(e)) {
      const o = e as Record<string, unknown>
      if (o.name != null && ("renew_cost" in o || "transfer_cost" in o)) found.push(o)
    }
  }
  const byTld = new Map<string, RawPrice>()
  for (const e of found) {
    const tld = String(deref(e.name) ?? "").toLowerCase().replace(/^\./, "").trim()
    if (!tld || !/^[a-z0-9][a-z0-9.-]*$/.test(tld) || byTld.has(tld)) continue
    const register = toPrice(String(deref(e.price) ?? ""))
    const renew = toPrice(String(deref(e.renew_cost) ?? ""))
    const transfer = e.transfer_cost != null && e.transfer_cost !== "" ? toPrice(String(deref(e.transfer_cost) ?? "")) : null
    if (register == null && renew == null && transfer == null) continue
    byTld.set(tld, {
      tld,
      currency: "ZAR",
      sourceUrl: URL,
      registerPrice: register,
      renewPrice: renew,
      transferPrice: transfer,
    })
  }
  const out = [...byTld.values()]
  if (out.length === 0) throw new Error("afrihost 解析结果为空(页面结构可能已变化)")
  return out
}

export const afrihostAdapter = defineAdapter({
  slug: "afrihost",
  name: "Afrihost",
  website: "https://www.afrihost.com",
  owner: "Data Team",
  version: "2.1.0",
  parserVersion: "2.1.0",
  currency: "ZAR",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["ZAR"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 90_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse(raw: string): RawPrice[] {
        return extractNuxtPrices(raw)
      },
    },
    {
      type: "playwright",
      url: URL,
      browser: { extract: "html", scrollToBottom: false, waitForTimeoutMs: 30_000 },
      parse(raw: string): RawPrice[] {
        return extractNuxtPrices(raw)
      },
    },
  ],
})
