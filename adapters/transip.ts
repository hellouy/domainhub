/**
 * TransIP —— 荷兰注册商, /beschikbare-domeinextensies/ 全量扩展卡片(EUR)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.transip.nl/beschikbare-domeinextensies/
 * 结构: 490 个 <li class="domain-extensions-tld"> 卡片, data-price(分)=注册首期价,
 *       data-gtm-ga-ee-price=常规续费价(卡片脚注 "Actietarief geldt voor de eerste
 *       periode, daarna € X" 证实); 无转入价。
 * 2026-11-05 新建独立适配器: SSR 直连即含全量卡片数据, 无需浏览器/舰队/网关;
 *       playwright extract html 兜底。
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.transip.nl/beschikbare-domeinextensies/"

function extractCardPrices(raw: string): RawPrice[] {
  const blocks = raw.split('<li class="domain-extensions-tld"').slice(1)
  const byTld = new Map<string, RawPrice>()
  for (const b of blocks) {
    const tld = (
      b.match(/data-gtm-ga-ee-name="Domain \.([a-z0-9.-]+)"/) ||
      b.match(/<span class="domain-extensions-tld__name">\.([a-z0-9.-]+)<\/span>/)
    )?.[1]
    const registerCents = Number.parseInt(b.match(/ data-price="(\d+)"/)?.[1] ?? "", 10)
    const renewRaw = b.match(/data-gtm-ga-ee-price="([\d.]+)"/)?.[1]
    const renewPrice = renewRaw ? Number.parseFloat(renewRaw) : null
    if (!tld || !Number.isFinite(registerCents) || byTld.has(tld)) continue
    byTld.set(tld, {
      tld: tld.toLowerCase(),
      currency: "EUR",
      sourceUrl: URL,
      registerPrice: registerCents / 100,
      renewPrice,
      transferPrice: null,
    })
  }
  const out = [...byTld.values()]
  if (out.length === 0) throw new Error("transip 解析结果为空(页面结构可能已变化)")
  return out
}

export const transipAdapter = defineAdapter({
  slug: "transip",
  name: "TransIP",
  website: "https://www.transip.nl",
  owner: "Data Team",
  version: "2.0.0",
  parserVersion: "2.0.0",
  currency: "EUR",
  capabilities: { registration: true, renewal: true, transfer: false, supportedCurrencies: ["EUR"] },
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
