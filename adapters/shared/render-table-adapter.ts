/**
 * 浏览器渲染 + 表格列配置解析的适配器工厂
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 适用于"价格表由 JS 渲染、直连 fetch 拿不到表格"的站点：
 * playwright 策略走 browser-worker /render(extract=html) 拿完整渲染页,
 * 再复用 table-adapter 的行提取/列语义解析。
 */
import { defineAdapter, type RawPrice, type RegistrarCapabilities, type RateLimitConfig } from "@/packages/adapter-sdk"
import { extractTableRows, findTldCell, parsePrice, defaultNormalize } from "./table-adapter"

interface RenderedTableConfig {
  slug: string
  name: string
  website: string
  currency: string
  url: string
  columnOrder: ("register" | "renew" | "transfer" | "restore" | "skip")[]
  numberFormat?: "en" | "eu" | "fr"
  rowFilter?: (cells: string[]) => boolean
  /**
   * 当 registerPrice < renewPrice 时，将 registerPrice 视为首年促销价、
   * 续费价视为标准注册价。适用于 julyname/59cn 等"首年特价"站点。
   */
  firstYearIsPromo?: boolean
  owner?: string
  waitForTimeoutMs?: number
  capabilities?: RegistrarCapabilities
  rateLimit?: RateLimitConfig
  priority?: number
}

async function renderHtml(fetchFn: (url: string, init?: RequestInit) => Promise<Response>, url: string, waitMs: number): Promise<string> {
  const base = process.env.BROWSER_SERVICE_URL ?? "http://127.0.0.1:8840"
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
  let html: string | null = null
  let lastErr = ""
  for (let attempt = 0; attempt < 3 && html === null; attempt++) {
    if (attempt > 0) await sleep(5_000)
    const res = await fetchFn(`${base}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ url, extract: "html", scrollToBottom: true, waitForTimeoutMs: waitMs }),
    })
    try {
      const data = (await res.json()) as { ok?: boolean; html?: string; error?: string }
      if (data.ok && data.html && /<tr/i.test(data.html)) html = data.html
      else lastErr = data.error ?? `HTTP ${res.status}（页面为空）`
    } catch {
      lastErr = `HTTP ${res.status}`
    }
  }
  if (html === null) throw new Error(lastErr || "浏览器渲染失败")
  return html
}

export function createRenderedTableAdapter(config: RenderedTableConfig) {
  const columnOrder = config.columnOrder
  const numberFormat = config.numberFormat ?? "en"
  const rowFilter = config.rowFilter
  return defineAdapter({
    slug: config.slug,
    name: config.name,
    website: config.website,
    owner: config.owner ?? "Data Team",
    version: "1.0.0",
    parserVersion: "1.0.0",
    currency: config.currency,
    priority: config.priority ?? 50,
    capabilities: config.capabilities ?? {
      registration: true,
      renewal: true,
      transfer: true,
      supportedCurrencies: [config.currency],
    },
    rateLimit: config.rateLimit ?? { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 120_000 },
    strategies: [
      {
        type: "playwright",
        url: config.url,
        async fetch(ctx) {
          return renderHtml(ctx.fetch.bind(ctx), config.url, config.waitForTimeoutMs ?? 12_000)
        },
        parse(raw): RawPrice[] {
          const rows = extractTableRows(raw)
          const prices: RawPrice[] = []
          const seen = new Set<string>()
          for (const cells of rows) {
            if (rowFilter && !rowFilter(cells)) continue
            const normCells = defaultNormalize(cells)
            const tldHit = findTldCell(normCells)
            if (!tldHit) continue
            const [tld, tldIdx] = tldHit
            if (seen.has(tld)) continue
            const priceValues: (number | null)[] = []
            for (let i = tldIdx + 1; i < cells.length; i++) {
              priceValues.push(parsePrice(cells[i], numberFormat))
            }
            if (priceValues.every((v) => v === null)) continue
            const price: RawPrice = { tld, currency: config.currency, sourceUrl: config.url }
            let vi = 0
            for (const role of columnOrder) {
              if (vi >= priceValues.length) break
              const value = priceValues[vi]
              vi++
              if (role === "skip") continue
              if (role === "register") price.registerPrice = value
              else if (role === "renew") price.renewPrice = value
              else if (role === "transfer") price.transferPrice = value
              else if (role === "restore") price.restorePrice = value
            }
            if (price.registerPrice == null && price.renewPrice == null && price.transferPrice == null) continue
            if (config.firstYearIsPromo && price.registerPrice != null && price.renewPrice != null && price.registerPrice < price.renewPrice) {
              price.promotionPrice = price.registerPrice
              price.registerPrice = price.renewPrice
            }
            seen.add(tld)
            prices.push(price)
          }
          if (prices.length === 0) throw new Error(`${config.slug} 表格解析结果为空(页面结构可能已变化)`)
          return prices
        },
      },
    ],
  })
}
