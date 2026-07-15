/**
 * 通用自动适配器工厂 createAutoAdapter
 * ------------------------------------------------------------
 * 所有权: Platform Team
 *
 * 目标: 只给一个价格页 URL, 就能按"真实数据源优先"的多策略链自动采集,
 * 无需为每个注册商手写解析逻辑。供后台"添加网址即自动抓取"使用。
 *
 * 策略优先级(与用户要求一致, LLM 仅作最后兜底):
 *   1. embedded-json  静态 HTML 里的内嵌 JSON(__NEXT_DATA__/__NUXT__/ld+json...)
 *   2. html           Cheerio 结构化解析(table/dl/ul/div)
 *   3. render         Playwright 渲染 + 捕获 XHR/fetch JSON 响应, 再跑发现引擎
 *                     (先 XHR-JSON, 再内嵌 JSON, 再 Cheerio)
 *   4. llm            分块 LLM 抽取(仅在以上全失败且已配置 ZHIPU_API_KEY 时)
 *
 * 单次采集内缓存已抓取/已渲染的 HTML, 避免各策略重复网络请求。
 */

import {
  defineAdapter,
  type AdapterContext,
  type AdapterDefinition,
  type RawPrice,
  type RegistrarCapabilities,
} from "@/packages/adapter-sdk"
import {
  collectJsonSources,
  discoverPrices,
  extractPricesFromHtmlStructured,
  type DiscoveredPrice,
} from "@/packages/discovery"
import { extractPricesFromJsonSources } from "@/packages/discovery/json-sources"

export interface AutoAdapterConfig {
  slug: string
  name: string
  website: string
  currency: string
  /** 价格页 URL(单页给字符串, 多页给数组) */
  url: string | string[]
  owner?: string
  version?: string
  /** 是否允许 Playwright 渲染策略(默认 true) */
  useRenderer?: boolean
  /** 渲染等待条件: CSS 选择器或毫秒数, 默认等 networkidle */
  renderWaitFor?: string | number
  /** 只捕获 URL 含这些子串的 XHR 响应(缩小噪音, 省略则捕获全部 JSON) */
  captureUrlIncludes?: string[]
  /** 是否启用 LLM 分块兜底(默认 true) */
  llmFallback?: boolean
  capabilities?: RegistrarCapabilities
  priority?: number
  /** 额外请求头 */
  headers?: Record<string, string>
}

/** DiscoveredPrice → RawPrice */
function toRawPrices(prices: DiscoveredPrice[], currency: string, sourceUrl: string): RawPrice[] {
  const out: RawPrice[] = []
  for (const p of prices) {
    if (p.registerPrice == null && p.renewPrice == null && p.transferPrice == null && p.restorePrice == null) {
      continue
    }
    out.push({
      tld: p.tld,
      currency: p.currency ?? currency,
      registerPrice: p.registerPrice,
      renewPrice: p.renewPrice,
      transferPrice: p.transferPrice,
      restorePrice: p.restorePrice,
      sourceUrl,
    })
  }
  return out
}

export function createAutoAdapter(config: AutoAdapterConfig) {
  const urls = Array.isArray(config.url) ? config.url : [config.url]
  const primaryUrl = urls[0]

  // 单次采集内的 HTML 缓存(适配器并发为 1)
  let staticHtml: string | null = null
  let renderedHtml: string | null = null
  let capturedJson: { url: string; body: string }[] = []

  async function fetchStatic(ctx: AdapterContext): Promise<string> {
    if (staticHtml != null) return staticHtml
    const pages: string[] = []
    for (const url of urls) {
      const res = await ctx.fetch(url, config.headers ? { headers: config.headers } : undefined)
      if (!res.ok) throw new Error(`${config.slug} 价格页 ${url} 返回 HTTP ${res.status}`)
      pages.push(await res.text())
    }
    staticHtml = pages.join("\n<!--PAGE_BREAK-->\n")
    return staticHtml
  }

  async function fetchRendered(ctx: AdapterContext): Promise<{ html: string; captured: { url: string; body: string }[] }> {
    if (renderedHtml != null) return { html: renderedHtml, captured: capturedJson }
    const pages: string[] = []
    const allCaptured: { url: string; body: string }[] = []
    for (const url of urls) {
      const rendered = await ctx.render(url, {
        waitFor: config.renderWaitFor,
        waitUntil: "networkidle",
        captureJson: true,
        captureUrlIncludes: config.captureUrlIncludes,
        headers: config.headers,
      })
      pages.push(rendered.html)
      if (rendered.capturedJson) allCaptured.push(...rendered.capturedJson)
    }
    renderedHtml = pages.join("\n<!--PAGE_BREAK-->\n")
    capturedJson = allCaptured
    return { html: renderedHtml, captured: capturedJson }
  }

  // ---- 各策略定义(装配顺序在下方按 useRenderer 决定) ----

  // 静态 HTML 内嵌 JSON
  const staticJsonStrategy = {
    type: "embedded-json" as const,
    url: primaryUrl,
    async fetch(ctx: AdapterContext) {
      return fetchStatic(ctx)
    },
    parse(raw: string) {
      const sources = collectJsonSources(raw)
      const { prices } = extractPricesFromJsonSources(sources)
      const rows = toRawPrices(prices, config.currency, primaryUrl)
      if (rows.length === 0) throw new Error(`${config.slug} 未在静态 HTML 内嵌 JSON 中发现价格`)
      return rows
    },
  }

  // Cheerio 结构化 HTML
  const staticHtmlStrategy = {
    type: "html" as const,
    url: primaryUrl,
    async fetch(ctx: AdapterContext) {
      return fetchStatic(ctx)
    },
    parse(raw: string) {
      const prices = extractPricesFromHtmlStructured(raw, config.currency)
      const rows = toRawPrices(prices, config.currency, primaryUrl)
      if (rows.length === 0) throw new Error(`${config.slug} 结构化 HTML 未解析到价格`)
      return rows
    },
  }

  // 渲染 + 捕获 XHR + 发现引擎(真实数据源优先)
  const renderStrategy = {
    type: "render" as const,
    url: primaryUrl,
    async fetch(ctx: AdapterContext) {
      const { html, captured } = await fetchRendered(ctx)
      return JSON.stringify({ html, captured })
    },
    parse(raw: string) {
      const { html, captured } = JSON.parse(raw) as {
        html: string
        captured: { url: string; body: string }[]
      }
      const { prices } = discoverPrices({
        html,
        capturedJson: captured,
        currency: config.currency,
      })
      const rows = toRawPrices(prices, config.currency, primaryUrl)
      if (rows.length === 0) throw new Error(`${config.slug} 渲染后发现引擎未找到价格`)
      for (const r of rows) r.region = null
      return rows
    },
  }

  // 装配顺序:声明了 useRenderer 的站点为 JS/XHR 动态站,
  // 渲染+XHR 发现优先(避免静态页里的少量诱饵 JSON 提前命中导致数据不全);
  // 否则静态策略优先(更快更省)。
  const strategies =
    config.useRenderer === true
      ? [renderStrategy, staticJsonStrategy, staticHtmlStrategy]
      : config.useRenderer === false
        ? [staticJsonStrategy, staticHtmlStrategy]
        : [staticJsonStrategy, staticHtmlStrategy, renderStrategy]

  const definition: AdapterDefinition = {
    slug: config.slug,
    name: config.name,
    website: config.website,
    owner: config.owner ?? "Platform Team",
    version: config.version ?? "1.0.0",
    parserVersion: "1.0.0",
    currency: config.currency,
    priority: config.priority ?? 60,
    capabilities: config.capabilities ?? {
      registration: true,
      renewal: true,
      transfer: true,
      supportedCurrencies: [config.currency],
    },
    rateLimit: { concurrency: 1, rpm: 10, retries: 2, timeoutMs: 60_000 },
    strategies,
  }

  // 4. LLM 分块兜底(最后一级)
  if (config.llmFallback !== false) {
    definition.strategies.push({
      type: "html",
      url: primaryUrl,
      async fetch(ctx) {
        const { isLlmConfigured } = await import("@/packages/llm-parser")
        if (!isLlmConfigured()) {
          throw new Error(`${config.slug} LLM 兜底未启用(未配置 ZHIPU_API_KEY)`)
        }
        // 优先用渲染后的 HTML(数据更全); 无则用静态 HTML
        if (renderedHtml != null) return renderedHtml
        if (config.useRenderer !== false) {
          const { html } = await fetchRendered(ctx)
          return html
        }
        return fetchStatic(ctx)
      },
      async parse(raw, ctx) {
        const { extractPricesWithLlm } = await import("@/packages/llm-parser")
        await ctx.log("info", `${config.slug} 前序策略均未命中, 启用 LLM 分块兜底`)
        const result = await extractPricesWithLlm(raw, {
          registrar: config.name,
          currency: config.currency,
          sourceUrl: primaryUrl,
        })
        const currency = result.currency && result.currency !== "UNKNOWN" ? result.currency : config.currency
        const rows: RawPrice[] = []
        const seen = new Set<string>()
        for (const row of result.prices) {
          const tld = row.tld.trim().replace(/^\./, "").toLowerCase()
          if (!tld || seen.has(tld)) continue
          if (row.registerPrice == null && row.renewPrice == null && row.transferPrice == null) continue
          seen.add(tld)
          rows.push({
            tld,
            currency,
            registerPrice: row.registerPrice,
            renewPrice: row.renewPrice,
            transferPrice: row.transferPrice,
            sourceUrl: primaryUrl,
          })
        }
        await ctx.log("info", `${config.slug} LLM 分块抽取到 ${rows.length} 条价格`)
        if (rows.length === 0) throw new Error(`${config.slug} LLM 兜底也未抽取到价格`)
        return rows
      },
    })
  }

  return defineAdapter(definition)
}
