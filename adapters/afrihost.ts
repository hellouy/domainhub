/**
 * Afrihost —— 南非本地注册商, Nuxt 页面价格(ZAR)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.afrihost.com/domains
 * 结构: 静态 HTML 卡片仅显示注册价; window.__NUXT__ 内含全量三价数组
 *       [{ name, price, renew_cost, transfer_cost, parking_cost }, ...] (key 动态, 递归定位)
 * 2026-10-11 改为 playwright 策略: 页面会话内递归扫描 NUXT, 提取 register/renew/transfer。
 * 已验证 138 TLD; co.za/net.za/org.za 等 transfer=0 (免费转入)。
 * 特色: .africa/.durban/.joburg/.co.za/.mu 等非洲 ccTLD 与南非本地域名
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.afrihost.com/domains"

/** 页面上下文内执行的提取脚本：递归扫描 window.__NUXT__ 定位价格数组 */
function buildScript(): string {
  return `(() => {
  try {
    const nuxt = window.__NUXT__
    if (!nuxt) return JSON.stringify([{ tld: "__nonuxt__" }])
    const out = []
    const walk = (v, depth) => {
      if (depth > 8 || !v || typeof v !== "object") return
      if (Array.isArray(v)) {
        const arr = v
        if (arr.length > 0 && arr.every((e) => e && typeof e === "object" && typeof e.name === "string" && ("renew_cost" in e || "transfer_cost" in e))) {
          for (const e of arr) {
            if (typeof e.price === "string" && typeof e.renew_cost === "string") {
              out.push({ name: e.name, price: e.price, renew_cost: e.renew_cost, transfer_cost: String(e.transfer_cost ?? "") })
            }
          }
          return
        }
        for (const x of arr) walk(x, depth + 1)
        return
      }
      for (const x of Object.values(v)) walk(x, depth + 1)
    }
    walk(nuxt, 0)
    const uniq = new Map()
    for (const e of out) {
      if (!e.name) continue
      const k = e.name.toLowerCase().replace(/^\\./, "")
      if (!k || !/^[a-z0-9][a-z0-9.-]*$/.test(k)) continue
      uniq.set(k, e)
    }
    const result = [...uniq.values()].map((e) => ({
      tld: e.name.toLowerCase().replace(/^\\./, ""),
      register: parseFloat(e.price),
      renew: parseFloat(e.renew_cost),
      transfer: e.transfer_cost ? parseFloat(e.transfer_cost) : null,
    }))
    if (result.length === 0) return JSON.stringify([{ tld: "__empty_" + out.length + "_" }])
    return JSON.stringify(result)
  } catch (err) {
    return JSON.stringify([{ tld: "__err_" + String(err && err.message).slice(0, 80) }])
  }
})()`
}

export const afrihostAdapter = defineAdapter({
  slug: "afrihost",
  name: "Afrihost",
  website: "https://www.afrihost.com",
  owner: "Data Team",
  version: "2.0.0",
  parserVersion: "2.0.0",
  currency: "ZAR",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["ZAR"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 90_000 },
  strategies: [
    {
      type: "playwright",
      url: URL,
      async fetch(ctx: AdapterContext): Promise<string> {
        const base = process.env.BROWSER_SERVICE_URL ?? "http://127.0.0.1:8840"
        const token = process.env.BROWSER_SERVICE_TOKEN ?? ""
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
        let extracted: unknown[] | null = null
        let lastErr = ""
        for (let attempt = 0; attempt < 3 && extracted === null; attempt++) {
          if (attempt > 0) await sleep(8_000)
          const res = await ctx.fetch(`${base}/render`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({
              url: URL,
              extract: "extract-json",
              scrollToBottom: false,
              script: buildScript(),
            }),
          })
          try {
            const data = (await res.json()) as { ok?: boolean; extracted?: unknown[]; error?: string }
            if (data.ok && Array.isArray(data.extracted) && data.extracted.length > 0) extracted = data.extracted
            else lastErr = data.error ?? `HTTP ${res.status}（命中为空）`
          } catch {
            lastErr = `HTTP ${res.status}`
          }
        }
        if (extracted === null) throw new Error(lastErr || "浏览器渲染失败")
        return JSON.stringify(extracted)
      },
      parse(raw: string, _ctx: AdapterContext): RawPrice[] {
        const rows = JSON.parse(raw) as Array<{
          tld?: string
          registerPrice?: number | null
          renewPrice?: number | null
          transferPrice?: number | null
        }>
        const out: RawPrice[] = rows
          .filter((r) => r.tld && !String(r.tld).startsWith("__"))
          .map((r) => {
            const tld = r.tld!.toLowerCase().replace(/^\./, "")
            const price: RawPrice = { tld, currency: "ZAR", sourceUrl: URL }
            if (r.registerPrice != null) price.registerPrice = r.registerPrice
            if (r.renewPrice != null) price.renewPrice = r.renewPrice
            if (r.transferPrice != null) price.transferPrice = r.transferPrice
            return price
          })
          .filter((p) => p.registerPrice != null || p.renewPrice != null || p.transferPrice != null)
        if (out.length === 0) throw new Error("afrihost 解析结果为空(页面结构可能已变化)")
        return out
      },
    },
  ],
})
