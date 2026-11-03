/**
 * Gandi —— 法国注册商价目(EUR)
 * ------------------------------------------------------------
 * 源: https://www.gandi.net/en/domain/tld（SSR comparative-table）
 * 分页: ?prefix=a..z 以及 ?prefix=xn--（IDN/Punycode），共 27 页约 999 个后缀，
 *       每页包含该字母全部后缀（无页内分页）；默认页(无参数)仅字母 A 的 50 行
 * 列序: TLD | Creation(注册) | Transfer(转移) | Renewal(续费) | Owner Change | Restore(找回)
 * 促销: Creation 单元格为 <del>原价</del> + <ins>促销价</ins>（首年促销）
 * 特殊: cell-none/cell-contact 显示 "N/A"（溢价或企业专享，联系销售）→ 价格记 null
 *       Owner Change 列恒为 FREE，平台无对应字段，忽略
 * 币种 EUR。sourceUrl 使用每行自己的后缀详情页
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const LIST_URL = "https://www.gandi.net/en/domain/tld"
const PREFIXES = [
  ..."abcdefghijklmnopqrstuvwxyz".split(""),
  "xn--",
]

function parseEur(cellHtml: string | null): number | null {
  if (!cellHtml) return null
  if (/cell-none|cell-contact/.test(cellHtml)) return null
  const m = cellHtml.match(/([\d.]+)/)
  if (!m) return null
  const v = Number.parseFloat(m[1])
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null
}

function promoPrices(cellHtml: string): { register: number | null; promo: number | null } {
  const del = cellHtml.match(/<del class="comparative-table__normal-price">\s*€?\s*([\d.]+)/)
  const ins = cellHtml.match(/<ins class="comparative-table__price">\s*€?\s*([\d.]+)/)
  return {
    register: del ? Number.parseFloat(del[1]) : null,
    promo: ins ? Number.parseFloat(ins[1]) : null,
  }
}

export const gandiAdapter = defineAdapter({
  slug: "gandi",
  name: "Gandi",
  website: "https://www.gandi.net",
  owner: "Data Team",
  version: "1.1.0",
  parserVersion: "2.0.0",
  currency: "EUR",
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    supportedCurrencies: ["EUR"],
  },
  rateLimit: { concurrency: 1, rpm: 30, retries: 2, timeoutMs: 30_000 },
  strategies: [
    {
      type: "html",
      url: LIST_URL,
      async fetch(ctx: AdapterContext): Promise<string> {
        const pages: string[] = []
        for (const prefix of PREFIXES) {
          const res = await ctx.fetch(`${LIST_URL}?prefix=${encodeURIComponent(prefix)}`, {
            headers: {
              "Accept-Language": "en-US,en;q=0.9",
              Referer: LIST_URL,
            },
          })
          if (!res.ok) throw new Error(`Gandi prefix=${prefix} HTTP ${res.status}`)
          pages.push(await res.text())
        }
        return pages.join("\n<!--GANDI-PAGE-->\n")
      },
      async parse(raw: string): Promise<RawPrice[]> {
        const out: RawPrice[] = []
        const seen = new Set<string>()
        const rows = raw.match(/<tr class="comparative-table__row">[\s\S]*?<\/tr>/g) || []
        for (const row of rows) {
          const th = row.match(/<th[^>]*comparative-table__cell--tld[^>]*>([\s\S]*?)<\/th>/)
          if (!th) continue
          const link = th[1].match(/<a href="([^"]+)"[^>]*>([^<]*)<\/a>/)
          if (!link) continue
          const tld = link[2].replace(/^\./, "").trim().toLowerCase()
          if (!tld || seen.has(tld)) continue
          const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1])
          if (cells.length < 5) continue
          const creation = cells[0]
          const promo = /badge--promo/.test(creation) ? promoPrices(creation) : null
          const registerPrice = promo ? promo.register : parseEur(creation)
          const renewPrice = parseEur(cells[2])
          const transferPrice = parseEur(cells[1])
          const restorePrice = parseEur(cells[4])
          if (registerPrice == null && renewPrice == null && transferPrice == null) continue
          const href = link[1]
          const sourceUrl = href.startsWith("http") ? href : `https://www.gandi.net${href}`
          const price: RawPrice = { tld, currency: "EUR", registerPrice, renewPrice, transferPrice, restorePrice, sourceUrl }
          if (promo && promo.promo != null && promo.register != null && promo.promo < promo.register) {
            price.promotionPrice = promo.promo
          }
          seen.add(tld)
          out.push(price)
        }
        if (out.length < 100) throw new Error(`Gandi 解析行数异常: ${out.length}`)
        return out
      },
    },
  ],
})
