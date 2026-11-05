/**
 * Exabytes —— 马来西亚注册商, CSS3 Grid 价格卡片(MYR)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.exabytes.my/domains/domain-name-search
 * 结构: 60+ 个 TLD 卡片(cart.php 链接 query=.tld 标识), all-domain-price 段落含注册价,
 *       可选 pricing-onsale 内原价; 页面仅提供注册价。
 * 2026-11-05 改为 html 策略直连解析卡片, 无需浏览器; playwright extract html 兜底。
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.exabytes.my/domains/domain-name-search"

const cardRe =
  /query=\.([a-z0-9.]+)[^"]*"[\s\S]{0,350}?class="all-domain-price"[^>]*>\s*RM\s?([\d.,]+)\s*\/\s*yr/gi

function extractCardPrices(raw: string): RawPrice[] {
  const byTld = new Map<string, RawPrice>()
  for (const m of raw.matchAll(cardRe)) {
    const tld = m[1].toLowerCase().trim()
    const register = Number.parseFloat(m[2])
    if (!tld || !Number.isFinite(register) || byTld.has(tld)) continue
    byTld.set(tld, {
      tld,
      currency: "MYR",
      sourceUrl: URL,
      registerPrice: register,
      renewPrice: null,
      transferPrice: null,
    })
  }
  const out = [...byTld.values()]
  if (out.length === 0) throw new Error("exabytes 解析结果为空(页面结构可能已变化)")
  return out
}

export const exabytesAdapter = defineAdapter({
  slug: "exabytes",
  name: "Exabytes",
  website: "https://www.exabytes.my",
  owner: "Data Team",
  version: "2.0.0",
  parserVersion: "2.0.0",
  currency: "MYR",
  capabilities: { registration: true, renewal: false, transfer: false, supportedCurrencies: ["MYR"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 90_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse(raw: string): RawPrice[] {
        return extractCardPrices(raw)
      },
    },
    {
      type: "playwright",
      url: URL,
      browser: { extract: "html", scrollToBottom: false, waitForTimeoutMs: 30_000 },
      parse(raw: string): RawPrice[] {
        return extractCardPrices(raw)
      },
    },
  ],
})
