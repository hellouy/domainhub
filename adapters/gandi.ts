/**
 * Gandi 适配器(Adapter SDK 2.0)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源结论(2026-07):
 * 1. html: gandi.net/en/domain/tld 分页价格表(SSR),
 *    每页约 50 行, 逐页抓到空页为止 ✓ 首选
 * 2. api.gandi.net/v5/domain/tlds 需要 API Key(私有 API 备选,
 *    在后台配置凭证后自动启用)
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"
import { extractTableRows, findTldCell, parsePrice } from "./shared/table-adapter"

const BASE_URL = "https://www.gandi.net/en/domain/tld"
const API_BASE = "https://api.gandi.net/v5"
const MAX_PAGES = 25

export const gandiAdapter = defineAdapter({
  slug: "gandi",
  name: "Gandi",
  website: "https://www.gandi.net",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  priority: 40,
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    restore: true,
    dnssec: true,
    whoisPrivacy: true,
    nameservers: true,
    api: true,
    supportedCurrencies: ["USD", "EUR", "GBP", "TWD"],
    supportedLanguages: ["en", "fr", "es", "ja", "zh"],
  },
  rateLimit: { concurrency: 1, rpm: 20, retries: 2, timeoutMs: 60_000 },
  strategies: [
    {
      // 首选：Gandi v5 私有 API。后台配好 api_key 凭证(api.gandi.net)后自动启用，
      // 一次请求拿全量(数百 TLD)价格，覆盖远高于 SSR 分页。无 Key 时 fetch 抛错，
      // 策略引擎自动降级到下方 html。
      type: "private-api",
      url: `${API_BASE}/domain/tlds/prices`,
      async fetch(ctx) {
        const cred = await ctx.getCredential("api_key")
        const key = cred?.values.token
        if (!key) {
          throw new Error("Gandi API 缺少 api_key 凭证(api.gandi.net)。未配置时降级 SSR html")
        }
        const res = await ctx.fetch(`${API_BASE}/domain/tlds/prices`, {
          headers: { Authorization: `Apikey ${key}`, Accept: "application/json" },
        })
        if (!res.ok) {
          throw new Error(`Gandi API HTTP ${res.status}(401/403 = Key 无效；未配置时降级 SSR html)`)
        }
        return res.text()
      },
      async parse(raw): Promise<RawPrice[]> {
        const rows = JSON.parse(raw) as Array<{
          tld?: string
          currency?: string
          prices?: {
            register?: Record<string, unknown>
            renew?: Record<string, unknown>
            transfer?: Record<string, unknown>
          }
        }>
        const out: RawPrice[] = []
        const num = (v: unknown): number | null => {
          const n = typeof v === "number" ? v : v == null ? null : Number.parseFloat(String(v))
          return Number.isFinite(n as number) && (n as number) > 0 ? (n as number) : null
        }
        for (const row of rows) {
          const tld = String(row.tld ?? "").trim().toLowerCase().replace(/^\./, "")
          if (!tld) continue
          const reg = num(row.prices?.register?.gTLD) ?? num(row.prices?.register?.ccTLD)
          const renew = num(row.prices?.renew?.gTLD) ?? num(row.prices?.renew?.ccTLD)
          const transfer = num(row.prices?.transfer?.gTLD) ?? num(row.prices?.transfer?.ccTLD)
          if (reg == null && renew == null && transfer == null) continue
          out.push({
            tld,
            registerPrice: reg,
            renewPrice: renew,
            transferPrice: transfer,
            currency: (row.currency ?? "EUR").toUpperCase(),
            sourceUrl: `${API_BASE}/domain/tlds/prices`,
          })
        }
        if (out.length === 0) throw new Error("Gandi API 未解析出任何价格")
        return out
      },
    },
    {
      type: "html",
      url: BASE_URL,
      async fetch(ctx) {
        const pages: string[] = []
        for (let page = 1; page <= MAX_PAGES; page++) {
          const res = await ctx.fetch(`${BASE_URL}?page=${page}`, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
              Accept: "text/html",
            },
          })
          if (!res.ok) break
          const html = await res.text()
          // 该页解析不出任何 TLD 行时停止(比"下一页"链接更可靠)
          const rowCount = extractTableRows(html).filter((cells) => findTldCell(cells)).length
          if (rowCount === 0) break
          pages.push(html)
        }
        if (pages.length === 0) throw new Error("Gandi 价格页无法访问")
        return pages.join("\n<!--PAGE_BREAK-->\n")
      },
      parse(raw): RawPrice[] {
        const rows = extractTableRows(raw)
        const prices: RawPrice[] = []
        const seen = new Set<string>()
        for (const cells of rows) {
          const hit = findTldCell(cells)
          if (!hit) continue
          const [tld, tldIdx] = hit
          if (seen.has(tld)) continue
          const values: (number | null)[] = []
          for (let i = tldIdx + 1; i < cells.length; i++) values.push(parsePrice(cells[i]))
          if (values.every((v) => v === null)) continue
          seen.add(tld)
          prices.push({
            tld,
            registerPrice: values[0] ?? null,
            renewPrice: values[1] ?? null,
            transferPrice: values[2] ?? null,
            currency: "USD",
            sourceUrl: BASE_URL,
          })
        }
        if (prices.length === 0) throw new Error("Gandi 表格解析结果为空")
        return prices
      },
    },
  ],
})
