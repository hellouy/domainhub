/**
 * EuroDNS（eurodns.com）—— 比利时注册商价目(EUR)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.eurodns.com/domain-extensions (JS 卡片式, 非表格)
 * 分页: /domain-extensions/pN, 每页 20 个 TLD, 共 7 页 ≈ 140 个后缀。
 *
 * 卡片结构(每卡两段 DOM):
 *   <a.tldExtensionLink>  div.tldName  = 后缀(.ac)
 *   <a.tldFeesLink>       div.tldPrice:
 *     - span.tldLineDiscount       = 促销价(€43.00)  — 有促销时
 *     - div.price.strikethrough    = 原价(€105.00)   — 促销时作为参考价
 *     - div.priceNoDiscount        = 常规注册价(€50.00)
 *
 * 取价规则: 促销价(tldLineDiscount)优先作 promotionPrice,
 * 原价(strikethrough)或常规价(priceNoDiscount)作 registerPrice。
 * 首页仅展示注册价, 续费/转入价在各自 TLD 详情页, 此处留空。
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const BASE = "https://www.eurodns.com/domain-extensions"
const PAGE_URLS = [BASE, ...Array.from({ length: 6 }, (_, i) => `${BASE}/p${i + 2}`)]

function parseEur(s: string | undefined): number | null {
  if (!s) return null
  const m = s.replace(/&nbsp;/g, " ").match(/(\d[\d.,]*)/)
  if (!m) return null
  const cleaned = m[1].replace(/,/g, "")
  const v = Number.parseFloat(cleaned)
  return Number.isFinite(v) && v > 0 && v < 100_000 ? Math.round(v * 100) / 100 : null
}

function parseCard(raw: string, seen: Set<string>): RawPrice[] {
  const out: RawPrice[] = []
  const chunks = raw.split('<a class="no-decoration tldExtensionLink')
  for (const chunk of chunks.slice(1)) {
    const nameMatch = chunk.match(/class="tldName"[^>]*>([\s\S]*?)<\/div>/)
    if (!nameMatch) continue
    const tld = nameMatch[1].replace(/&nbsp;/g, " ").trim().toLowerCase().replace(/^\./, "")
    if (!tld || seen.has(tld)) continue
    const feesIdx = chunk.indexOf('<a class="no-decoration tldFeesLink')
    if (feesIdx < 0) continue
    const priceBlock = chunk.slice(feesIdx).split("</a>", 1)[0]
    const promo = parseEur(priceBlock.match(/tldLineDiscount">([^<]*)/)?.[1])
    const normal = parseEur(priceBlock.match(/priceNoDiscount">([^<]*)/)?.[1])
    const strike = parseEur(priceBlock.match(/price strikethrough">([^<]*)/)?.[1])
    const register = normal ?? strike
    const promotionPrice = promo
    if (register == null && promotionPrice == null) continue
    const p: RawPrice = { tld, currency: "EUR", sourceUrl: BASE }
    if (register != null) p.registerPrice = register
    if (promotionPrice != null) {
      p.promotion = true
      p.promotionPrice = promotionPrice
    }
    seen.add(tld)
    out.push(p)
  }
  return out
}

export const eurodnsAdapter = defineAdapter({
  slug: "eurodns",
  name: "EuroDNS",
  website: "https://www.eurodns.com",
  owner: "Data Team",
  version: "2.0.0",
  parserVersion: "2.0.0",
  currency: "EUR",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["EUR"] },
  rateLimit: { concurrency: 1, rpm: 6, retries: 2, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: BASE,
      async fetch(ctx) {
        const parts: string[] = []
        for (const url of PAGE_URLS) {
          const res = await ctx.fetch(url, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
              Accept: "text/html,application/xhtml+xml",
            },
          })
          if (!res.ok) throw new Error(`eurodns 价格页 ${url} 返回 HTTP ${res.status}`)
          parts.push(await res.text())
        }
        return parts.join("\n<!--PAGE_BREAK-->\n")
      },
      parse(raw): RawPrice[] {
        const seen = new Set<string>()
        const out: RawPrice[] = []
        for (const part of raw.split("\n<!--PAGE_BREAK-->\n")) {
          out.push(...parseCard(part, seen))
        }
        if (out.length === 0) throw new Error("eurodns 卡片解析结果为空(页面结构可能已变化)")
        return out
      },
    },
  ],
})
