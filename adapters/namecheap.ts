/**
 * Namecheap 适配器(Adapter SDK 2.0)— Parse.bot 托管 API
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源结论(2026-10-14):
 * 1. private-api: 官方 users.getPricing XML 接口要求 API Key + 出口 IP 白名单,
 *    无凭证, 一直采不到。
 * 2. 官网 full-tld-list 价格页: FlareSolverr/Browserless 均无法拿全量
 *    (SSR 只有首屏 50 行, JS 滚动加载被反爬阻断; browser-worker 远程卡死)。
 * 3. 现用: Parse.bot marketplace 现成 Namecheap API(fork 后补上 transferPrice),
 *    REST GET 单次调用返回全部 571 TLD 的 register/renew/transfer 价格。
 *    端点信息已在下方 URL 注释, 依赖 PARSE_BOT_API_KEY 环境变量。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const PARSE_BASE =
  "https://api.parse.bot/scraper/1343754a-086c-4c84-83b1-cc53e3f95f0c/list_tld_prices"



export const namecheapAdapter = defineAdapter({
  slug: "namecheap",
  name: "Namecheap",
  website: "https://www.namecheap.com",
  owner: "Data Team",
  version: "2.0.0",
  parserVersion: "2.0.0",
  currency: "USD",
  priority: 25,
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    whoisPrivacy: true,
    dnssec: true,
    api: true,
    bulkSearch: true,
    affiliate: true,
    marketplace: true,
    supportedCurrencies: ["USD"],
    supportedLanguages: ["en"],
  },
  rateLimit: { concurrency: 1, rpm: 6, retries: 2, timeoutMs: 120_000 },
  strategies: [
    {
      type: "api",
      url: PARSE_BASE,
      async fetch(ctx: AdapterContext): Promise<string> {
        const key = process.env.PARSE_BOT_API_KEY ?? ""
        if (!key) {
          throw new Error(
            "Namecheap 缺少 PARSE_BOT_API_KEY 环境变量。请先将 Parse.bot API key 配置为 PARSE_BOT_API_KEY 再采集。",
          )
        }
        // 私有 API 读取操作不做代理, 直接带鉴权头调用托管服务
        const raw = await fetch(PARSE_BASE, {
          headers: { "X-API-Key": key },
          signal: AbortSignal.timeout(90_000),
        })
        if (!raw.ok) throw new Error(`Parse.bot list_tld_prices 返回 HTTP ${raw.status}`)
        return raw.text()
      },
      async parse(raw: string): Promise<RawPrice[]> {
        const payload = JSON.parse(raw) as {
          data: {
            tlds: Array<{
              Name: string
              Pricing: {
                Price?: number
                Regular?: number
                Renewal?: number
                transferPrice?: number
                Hint?: string | null
              }
            }>
          }
        }
        const rows = payload.data?.tlds
        if (!Array.isArray(rows) || rows.length === 0) {
          throw new Error("Parse.bot list_tld_prices 响应缺少 data.tlds 数组(结构可能漂移)")
        }
        const prices: RawPrice[] = []
        for (const r of rows) {
          const name = (r.Name ?? "").toLowerCase().replace(/^\./, "")
          if (!name) continue
          const p = r.Pricing ?? {}
          const num = (v: unknown): number | null => {
            const n = typeof v === "number" && Number.isFinite(v) ? v : Number(v)
            return Number.isFinite(n) && n > 0 ? n : null
          }
          prices.push({
            tld: name,
            registerPrice: num(p.Price),
            renewPrice: num(p.Renewal),
            transferPrice: num(p.transferPrice),
            promotion: Boolean(p.Hint),
            currency: "USD",
            sourceUrl: "https://www.namecheap.com/domains/full-tld-list/",
          })
        }
        return prices
      },
    },
  ],
})