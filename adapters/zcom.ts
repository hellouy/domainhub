/**
 * Z.com (web.z.com) —— 美国域名价格列表
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://web.z.com/us/domain/pricelist/
 * 结构: HTML 表格，每个 TLD 一行 li.priceTableBodyItem js-tldLists
 *       data-tld 属性含 TLD 名，三列 .is-register / .is-renewal / .is-transfer
 *       注册列含 <del> 原价 + <p class="is-sale"> 当前促销价
 * 年份: 页面支持多年切换，data-year="1" 为首年价格，解析它
 * 货币: USD
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://web.z.com/us/domain/pricelist/"

function parsePrice(raw: string): number | null {
  const m = raw.replace(/<[^>]+>/g, "").trim().replace(/[$,]/g, "")
  if (!m) return null
  const n = Number.parseFloat(m)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

async function parseZcom(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()

  // 匹配 data-year="1" 的行块（含所有 TLD li）
  const yearBlock = raw.match(/data-year="1"[^>]*>([\s\S]*?)<\/ul>\s*<\/div>\s*<\/div>\s*<\/div>/i)
  const content = yearBlock ? yearBlock[1] : raw

  // 提取每个 TLD 行
  const rows = content.match(/<li class="priceTableBodyItem js-tldLists"[^>]*data-tld="([^"]+)"[^>]*>([\s\S]*?)<\/li>/gi) ?? []

  for (const row of rows) {
    const tldMatch = row.match(/data-tld="([^"]+)"/)
    if (!tldMatch) continue
    const tld = tldMatch[1].toLowerCase()
    if (!/^[a-z0-9-]{2,}$/.test(tld) || seen.has(tld)) continue
    seen.add(tld)

    // 提取三列（列 div 以 </div> 结束，后面是下一列 <div>，不是立即跟 </li>）
    const regMatch = row.match(/<div class="priceTableBodyUnit is-register"[^>]*>([\s\S]*?)<\/div>\s*<div/i)
    const renMatch = row.match(/<div class="priceTableBodyUnit is-renewal"[^>]*>([\s\S]*?)<\/div>\s*<div/i)
    const trfMatch = row.match(/<div class="priceTableBodyUnit is-transfer"[^>]*>([\s\S]*?)<\/div>\s*(?:<div|<\/li>)/i)

    const readCol = (html: string): { reg?: number; promo?: number } => {
      if (!html) return {}
      const del = html.match(/<del[^>]*>[\s\S]*?\$?([\d,.]+)[\s\S]*?<\/del>/i)
      const sale = html.match(/<p class="priceTableBodyUnit_price is-sale"[^>]*>[\s\S]*?\$?([\d,.]+)[\s\S]*?<\/p>/i)
      const reg = sale ? parsePrice(sale[1] ?? "") : (del ? parsePrice(del[1] ?? "") : null)
      const promo = del && sale ? parsePrice(del[1] ?? "") ?? undefined : undefined
      return { reg: reg ?? undefined, promo }
    }

    const regData = regMatch ? readCol(regMatch[1]) : {}
    const ren = renMatch ? parsePrice(renMatch[1]) : null
    const trf = trfMatch ? parsePrice(trfMatch[1]) : null

    if (regData.reg == null && ren == null && trf == null) continue

    const price: RawPrice = { tld, currency: "USD", sourceUrl: URL }
    if (regData.reg != null) price.registerPrice = regData.reg
    if (regData.promo != null) price.promotionPrice = regData.promo
    if (ren != null) price.renewPrice = ren
    if (trf != null) price.transferPrice = trf

    out.push(price)
  }

  if (out.length === 0) throw new Error("zcom 解析结果为空（页面结构可能已变化）")
  return out
}

export const zcomAdapter = defineAdapter({
  slug: "zcom",
  name: "Z.com",
  website: "https://web.z.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    supportedCurrencies: ["USD"],
    supportedLanguages: ["en"],
  },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse: parseZcom,
    },
  ],
})
