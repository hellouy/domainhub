/**
 * Afrihost —— 南非本地注册商, Nuxt 页面价格(ZAR)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.afrihost.com/domains
 * 结构: 静态 HTML 卡片仅显示注册价; window.__NUXT__ 内含全量三价数组
 *       [{ name, price, renew_cost, transfer_cost, parking_cost }, ...] (key 动态, 递归定位)
 * 2026-11-04 改为 html 策略直连解析: SSR HTML 内嵌 __NUXT__ payload, Node 侧递归提取
 *       register/renew/transfer, 无需浏览器舰队; playwright extract html 仅作直连被拦兜底。
 * 已验证 138 TLD; co.za/net.za/org.za 等 transfer=0 (免费转入)。
 * 特色: .africa/.durban/.joburg/.co.za/.mu 等非洲 ccTLD 与南非本地域名
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.afrihost.com/domains"

function toPrice(s: string): number | null {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : null
}

const isPriceEntry = (e: unknown): e is Record<string, unknown> =>
  e != null &&
  typeof e === "object" &&
  typeof (e as Record<string, unknown>).name === "string" &&
  ("renew_cost" in (e as Record<string, unknown>) || "transfer_cost" in (e as Record<string, unknown>))

function extractNuxtPrices(raw: string): RawPrice[] {
  const payloadMatch = raw.match(/window\.__NUXT__\s*=\s*([\s\S]*?)<\/script>/i)
  if (!payloadMatch) throw new Error("afrihost 未找到 window.__NUXT__ 内嵌数据(页面结构可能已变化)")
  let payload: unknown
  try {
    payload = JSON.parse(payloadMatch[1].replace(/;\s*$/, ""))
  } catch {
    throw new Error("afrihost __NUXT__ payload 不是合法 JSON(页面结构可能已变化)")
  }
  const found: Array<Record<string, unknown>> = []
  const walk = (v: unknown, depth: number): void => {
    if (depth > 8 || !v || typeof v !== "object") return
    if (Array.isArray(v)) {
      const arr = v as unknown[]
      if (arr.length > 0 && arr.every(isPriceEntry)) {
        for (const e of arr) {
          if (typeof e.price === "string" && typeof e.renew_cost === "string") found.push(e)
        }
        return
      }
      for (const x of arr) walk(x, depth + 1)
      return
    }
    for (const x of Object.values(v as Record<string, unknown>)) walk(x, depth + 1)
  }
  walk(payload, 0)
  const byTld = new Map<string, RawPrice>()
  for (const e of found) {
    const tld = String(e.name ?? "").toLowerCase().replace(/^\./, "").trim()
    if (!tld || !/^[a-z0-9][a-z0-9.-]*$/.test(tld) || byTld.has(tld)) continue
    const register = toPrice(String(e.price ?? ""))
    const renew = toPrice(String(e.renew_cost ?? ""))
    const transfer = e.transfer_cost != null && e.transfer_cost !== "" ? toPrice(String(e.transfer_cost)) : null
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
