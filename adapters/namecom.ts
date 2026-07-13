/**
 * Name.com 适配器(Adapter SDK 2.0)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源结论(2026-07):
 * 1. xhr: /ajax/pricing/?duration=1 需要先取 /pricing 页的
 *    Cookie + <meta name="csrf-token">, 然后带 X-CSRF-Token 调用 ✓ 首选
 * 2. html: /pricing 页含内嵌 tlds 数组(仅热门后缀) → 降级
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const PAGE_URL = "https://www.name.com/pricing"
const AJAX_URL = "https://www.name.com/ajax/pricing/?duration=1"
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

interface NamecomEntry {
  tld?: string
  registration_price?: string | number
  renewal_price?: string | number
  transfer_price?: string | number
  [key: string]: unknown
}

function toRawPrices(entries: NamecomEntry[]): RawPrice[] {
  const prices: RawPrice[] = []
  for (const e of entries) {
    const tld = typeof e.tld === "string" ? e.tld.replace(/^\./, "").toLowerCase() : null
    if (!tld) continue
    prices.push({
      tld,
      registerPrice: (e.registration_price as string | number | undefined) ?? null,
      renewPrice: (e.renewal_price as string | number | undefined) ?? null,
      transferPrice: (e.transfer_price as string | number | undefined) ?? null,
      currency: "USD",
      sourceUrl: PAGE_URL,
    })
  }
  return prices
}

/** 递归收集 JSON 中所有带 tld + 价格字段的对象 */
function collectEntries(node: unknown, out: NamecomEntry[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectEntries(item, out)
  } else if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>
    if (typeof obj.tld === "string" && ("registration_price" in obj || "renewal_price" in obj)) {
      out.push(obj as NamecomEntry)
    } else {
      for (const v of Object.values(obj)) collectEntries(v, out)
    }
  }
}

export const namecomAdapter = defineAdapter({
  slug: "namecom",
  name: "Name.com",
  website: "https://www.name.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  priority: 40,
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    premiumDomains: true,
    dnssec: true,
    whoisPrivacy: true,
    api: true,
    supportedCurrencies: ["USD"],
    supportedLanguages: ["en"],
  },
  rateLimit: { concurrency: 1, rpm: 10, retries: 2, timeoutMs: 60_000 },
  strategies: [
    {
      type: "xhr",
      url: AJAX_URL,
      async fetch(ctx) {
        // 第一步: 取页面获得 Cookie + CSRF token
        const pageRes = await ctx.fetch(PAGE_URL, {
          headers: { "User-Agent": UA, Accept: "text/html" },
        })
        if (!pageRes.ok) throw new Error(`Name.com 价格页返回 HTTP ${pageRes.status}`)
        const html = await pageRes.text()
        const csrf = html.match(/<meta\s+name="csrf-token"\s+content="([^"]+)"/)?.[1]
        const setCookies = pageRes.headers.getSetCookie?.() ?? []
        const cookie = setCookies.map((c) => c.split(";")[0]).join("; ")
        if (!csrf) throw new Error("Name.com 页面未找到 csrf-token")
        // 第二步: 带 token 调用 XHR
        const res = await ctx.fetch(AJAX_URL, {
          headers: {
            "User-Agent": UA,
            Accept: "application/json",
            Referer: PAGE_URL,
            "X-CSRF-Token": csrf,
            ...(cookie ? { Cookie: cookie } : {}),
          },
        })
        if (!res.ok) throw new Error(`Name.com ajax 返回 HTTP ${res.status}`)
        return res.text()
      },
      parse(raw): RawPrice[] {
        const data = JSON.parse(raw) as unknown
        const entries: NamecomEntry[] = []
        collectEntries(data, entries)
        const prices = toRawPrices(entries)
        if (prices.length === 0) throw new Error("Name.com ajax 数据中未找到价格条目")
        return prices
      },
    },
    {
      type: "embedded-json",
      url: PAGE_URL,
      async fetch(ctx) {
        const res = await ctx.fetch(PAGE_URL, {
          headers: { "User-Agent": UA, Accept: "text/html" },
        })
        if (!res.ok) throw new Error(`Name.com 价格页返回 HTTP ${res.status}`)
        return res.text()
      },
      parse(raw): RawPrice[] {
        // 页面内嵌 "tlds = [...]" 数组(热门后缀)
        const m = raw.match(/tlds\s*=\s*(\[[\s\S]*?\])\s*[;\n]/)
        if (!m) throw new Error("Name.com 页面未找到内嵌 tlds 数组")
        const data = JSON.parse(m[1]) as unknown
        const entries: NamecomEntry[] = []
        collectEntries(data, entries)
        const prices = toRawPrices(entries)
        if (prices.length === 0) throw new Error("Name.com 内嵌数据中未找到价格条目")
        return prices
      },
    },
  ],
})
