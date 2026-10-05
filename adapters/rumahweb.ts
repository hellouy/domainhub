/**
 * Rumahweb —— 印尼注册商价目(IDR)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.rumahweb.com/domain (SSR, 5MB, 558 行)
 * 每行 `<tr class="domain-row" data-ext=".id" data-price="219000" ...>`:
 *   data-price         = 当前展示价（促销行为促销价，普通行为注册价）
 *   .line-through 上的 Rp 原价 = 标准注册价（仅促销行存在）
 *   popover 内 `Renewal: Rp 219.000` = 续费价
 * 促销行: 原价 60.000(划掉) + data-price 9.900 → register=60000, promotion=9900。
 * 币种 IDR。验证: ~558 TLD, .id = 219000 IDR。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.rumahweb.com/domain"

function toIdr(s: string | null | undefined): number | null {
  if (!s) return null
  const digits = s.replace(/[^\d]/g, "")
  if (!digits) return null
  const v = Number.parseInt(digits, 10)
  return Number.isFinite(v) && v > 0 ? v : null
}

async function parseRumahweb(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const rowRe = /<tr\b[^>]*\bdata-ext="([^"]+)"[^>]*\bdata-price="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/gi
  for (const m of raw.matchAll(rowRe)) {
    const tld = (m[1] ?? "").replace(/^\./, "").trim().toLowerCase()
    if (!tld || !/^[a-z0-9][a-z0-9.-]*$/.test(tld) || seen.has(tld)) continue
    const body = m[3] ?? ""
    const current = toIdr(m[2])
    const struck = toIdr((body.match(/line-through[^>]*>([^<]*)</i) || [])[1])
    const renew = toIdr((body.match(/Renewal:[\s\S]{0,600}?Rp[^0-9]*([\d.]+)/i) || [])[1])
    if (current == null && renew == null) continue
    const price: RawPrice = { tld, currency: "IDR", sourceUrl: URL }
    if (struck != null && current != null && struck > current) {
      price.registerPrice = struck
      price.promotionPrice = current
    } else if (current != null) {
      price.registerPrice = current
    }
    if (renew != null) price.renewPrice = renew
    seen.add(tld)
    out.push(price)
  }
  if (out.length < 50) throw new Error(`rumahweb 解析行数异常: ${out.length}(页面结构可能已变化)`)
  return out
}

export const rumahwebAdapter = defineAdapter({
  slug: "rumahweb",
  name: "Rumahweb",
  website: "https://www.rumahweb.com",
  owner: "Data Team",
  version: "1.0.1",
  parserVersion: "1.0.1",
  currency: "IDR",
  capabilities: { registration: true, renewal: true, transfer: false, supportedCurrencies: ["IDR"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 90_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse: parseRumahweb,
    },
  ],
})