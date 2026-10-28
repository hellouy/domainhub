/**
 * one.com 适配器 (v3.0.0)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源 (2026-10 重构):
 * https://www.one.com/en/domain/prices — SSR 完整价目表, 447 行,
 * 列: TLD | Registration | Transfer | Renewal | Redemption
 *
 * 价格格式 (每列):
 *   - 有促销: <span>当前价</span> <span class="line-through">原价</span>
 *   - 无促销: <span></span> <span class="no-rebate">标准价</span>
 *   - Renewal: <span>续费价</span> (始终单值, 等于注册原价)
 *
 * 语义映射:
 *   registerPrice = 划线原价/no-rebate 值 (标准注册价, 与 renewPrice 相同)
 *   promotionPrice = 当前促销价 (若 < registerPrice)
 *   renewPrice    = Renewal 列单一 span 值
 *   transferPrice = Transfer 划线原价/no-rebate 值
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const PAGE_URL = "https://www.one.com/en/domain/prices"

function extractPrices(html: string): RawPrice[] {
  const prices: RawPrice[] = []
  const seen = new Set<string>()

  const rowRe = /<tr data-pub-price-row>[\s\S]*?<\/tr>/gi
  let row: RegExpExecArray | null

  while ((row = rowRe.exec(html)) !== null) {
    const tr = row[0]

    const tldMatch = tr.match(/<th[^>]*pubPriceList-cell-tld[^>]*>\s*(\S+?)\s*<\/th>/i)
    if (!tldMatch) continue
    const tld = tldMatch[1].replace(/^\./, "").toLowerCase()
    if (!tld || seen.has(tld)) continue
    seen.add(tld)

    const regCell = getCell(tr, "Registration")
    const trCell = getCell(tr, "Transfer")
    const renewCell = getCell(tr, "Renewal")
    const redemptionCell = getCell(tr, "Redemption")

    const regStd = getStandardPrice(regCell)   // 划线原价/no-rebate
    const regCurrent = getCurrentPrice(regCell) // 当前促销价

    const transferStd = getStandardPrice(trCell)
    const transferCurrent = getCurrentPrice(trCell)

    const renew = getRenewalPrice(renewCell)
    const redemption = getRedemptionPrice(redemptionCell)

    const price: RawPrice = {
      tld,
      currency: "USD",
      sourceUrl: PAGE_URL,
    }

    // register: 标准价必填, 促销价(若存在且低于标准价)也填
    if (regStd != null) price.registerPrice = regStd
    if (regCurrent != null && regStd != null && regCurrent < regStd) {
      price.promotionPrice = regCurrent
    }

    if (transferStd != null) price.transferPrice = transferStd

    if (renew != null) price.renewPrice = renew

    if (redemption != null) price.restorePrice = redemption

    if (price.registerPrice == null && price.renewPrice == null && price.transferPrice == null) continue
    prices.push(price)
  }

  return prices
}

/** 从指定 data-label 的 <td> 中提取原始 HTML 内容 */
function getCell(tr: string, label: string): string {
  const re = new RegExp(`data-label='${label}'>([\\s\\S]*?)</td>`, "i")
  const m = tr.match(re)
  return m ? m[1] : ""
}

/** 从单元格提取划线原价或 no-rebate 值 (标准价) */
function getStandardPrice(cell: string): number | null {
  const m = cell.match(/<span[^>]*\b(?:line-through|no-rebate)[^>]*>\s*([\d.]+)\s*</i)
  if (m) return parseFloat(m[1])
  return null
}

/** 从单元格提取当前售价 (非划线/no-rebate span 的第一个数字) */
function getCurrentPrice(cell: string): number | null {
  // 匹配 <span [attrs]>数字</span>, 排除含 line-through/no-rebate 的 span
  const spanRe = /<span([^>]*)>\s*([\d.]+)\s*<\/span>/gi
  let m: RegExpExecArray | null
  while ((m = spanRe.exec(cell)) !== null) {
    const attrs = m[1] ?? ""
    if (!/\b(?:line-through|no-rebate)\b/i.test(attrs)) {
      return parseFloat(m[2])
    }
  }
  return null
}

/** 提取 Renewal/Redemption 列单一 span 价格 */
function getSinglePrice(cell: string): number | null {
  const m = cell.match(/<span[^>]*>\s*([\d.]+)\s*<\/span>/i)
  return m ? parseFloat(m[1]) : null
}

/** 提取 Renewal 列单一 span 价格 */
function getRenewalPrice(cell: string): number | null {
  return getSinglePrice(cell)
}

/** 提取 Redemption 列价格 */
function getRedemptionPrice(cell: string): number | null {
  return getSinglePrice(cell)
}

export const onecomAdapter = defineAdapter({
  slug: "onecom",
  name: "one.com",
  website: "https://www.one.com",
  owner: "Data Team",
  version: "3.0.0",
  parserVersion: "3.0.0",
  currency: "USD",
  priority: 60,
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    dnssec: true,
    nameservers: true,
    supportedCurrencies: ["USD", "EUR", "GBP", "SEK", "DKK", "NOK"],
    supportedLanguages: ["en", "de", "fr", "es", "sv", "da", "no", "nl"],
  },
  rateLimit: { concurrency: 1, rpm: 10, retries: 2, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: PAGE_URL,
      async fetch(ctx) {
        const res = await ctx.fetch(PAGE_URL, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
        })
        if (!res.ok) throw new Error(`one.com 价格页返回 HTTP ${res.status}`)
        return res.text()
      },
      parse(raw): RawPrice[] {
        const prices = extractPrices(raw)
        if (prices.length === 0) throw new Error("one.com 价格解析结果为空, 页面结构可能已变化")
        return prices
      },
    },
  ],
})
