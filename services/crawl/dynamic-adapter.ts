/**
 * 动态适配器构建器
 * ------------------------------------------------------------
 * 所有权: Platform Team
 *
 * 让"只有 DB 规则、没有 TypeScript 适配器文件"的注册商也能采集。
 * 当内存注册表(getRegisteredAdapter)找不到某注册商时,若该注册商
 * 存在 active 的 adapter_rules(通常由 AI 修复代理/发现流程产出),
 * 用规则为配置临时构建一个 BaseAdapter。
 *
 * 两条路径:
 * - 纯 HTML 表格规则(strategy=html 且无翻页/浏览器)→ 复用 createTableAdapter,
 *   行为与历史完全一致(零风险)。
 * - 声明了非 html 策略 / 翻页 / 浏览器渲染的规则 → 直接构建多策略 defineAdapter,
 *   按 主策略 → HTML 兜底 → 浏览器兜底 的顺序自动降级,复用 extract 抽取核心。
 *
 * 该适配器不进内存注册表,仅供本次采集使用(避免污染 & 保证读到最新规则)。
 */

import { createTableAdapter } from "@/adapters/shared/table-adapter"
import { defineAdapter, type BaseAdapter, type RawPrice, type StrategyDefinition } from "@/packages/adapter-sdk"
import type { DynamicRule } from "@/packages/ai-repair/schema"
import { extractPricesFromRaw, extractFromHtmlTable, ruleStrategyOf } from "@/packages/ai-repair/extract"
import type { Registrar } from "@/lib/db/schema"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

const PAGE_BREAK = "\n<!--PAGE_BREAK-->\n"
const PAGE_HARD_CAP = 50

/** 展开翻页 URL 列表;无翻页时返回 dataUrl(单页)或全部价格页 */
function expandPages(rule: DynamicRule): string[] {
  const base = rule.dataUrl ?? rule.urls[0]
  const p = rule.pagination
  if (!p) return rule.dataUrl ? [rule.dataUrl] : rule.urls
  const start = p.start ?? 1
  const maxPages = Math.min(p.maxPages ?? 10, PAGE_HARD_CAP)
  const out: string[] = []
  for (let i = 0; i < maxPages; i++) {
    const page = start + i
    if (p.mode === "path" && p.pathTemplate) {
      out.push(p.pathTemplate.replace(/\{page\}/g, String(page)))
    } else {
      try {
        const u = new URL(base)
        u.searchParams.set(p.param ?? "page", String(page))
        out.push(u.toString())
      } catch {
        // base 非法则退回单页
        out.push(base)
        break
      }
    }
  }
  return out
}

/** 逐页拉取(带早停:HTTP 失败 / 内容与上一页重复即停),多页用 PAGE_BREAK 拼接 */
function makePaginatedFetch(rule: DynamicRule) {
  return async (ctx: Parameters<NonNullable<StrategyDefinition["fetch"]>>[0]): Promise<string> => {
    const urls = expandPages(rule)
    const pages: string[] = []
    let prevSignature = ""
    for (const url of urls) {
      const res = await ctx.fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml,application/json",
        },
      })
      if (!res.ok) {
        if (pages.length > 0) break
        throw new Error(`${rule.urls[0]} 采集地址 ${url} 返回 HTTP ${res.status}`)
      }
      const text = await res.text()
      const signature = `${text.length}:${text.slice(0, 80)}`
      if (signature === prevSignature) break // 翻页到重复内容(已到末页),停止
      prevSignature = signature
      pages.push(text)
    }
    if (pages.length === 0) throw new Error(`${rule.urls[0]} 未取到任何页面内容`)
    return pages.join(PAGE_BREAK)
  }
}

/** 按主策略构建 parse:逐页抽取 + 跨页去重 */
function makeParse(strategy: string, rule: DynamicRule, slug: string) {
  return (raw: string): RawPrice[] => {
    const pages = raw.split(PAGE_BREAK)
    const out: RawPrice[] = []
    const seen = new Set<string>()
    for (const page of pages) {
      let prices: RawPrice[] = []
      try {
        prices = extractPricesFromRaw(strategy, page, rule)
      } catch {
        // 单页解析失败不影响其他页
      }
      for (const p of prices) {
        const tld = p.tld.toLowerCase().replace(/^\./, "")
        if (!tld || seen.has(tld)) continue
        seen.add(tld)
        out.push(p)
      }
    }
    if (out.length === 0) throw new Error(`${slug} [${strategy}] 解析结果为空(页面结构可能已变化)`)
    return out
  }
}

/** HTML 兜底策略(拉取全部价格页,表格解析) */
function htmlFallbackStrategy(rule: DynamicRule, slug: string): StrategyDefinition {
  return {
    type: "html",
    url: rule.urls[0],
    async fetch(ctx) {
      const pages: string[] = []
      for (const url of rule.urls) {
        const res = await ctx.fetch(url, {
          headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
        })
        if (!res.ok) throw new Error(`${slug} 价格页 ${url} 返回 HTTP ${res.status}`)
        pages.push(await res.text())
      }
      return pages.join(PAGE_BREAK)
    },
    parse(raw): RawPrice[] {
      const out: RawPrice[] = []
      const seen = new Set<string>()
      for (const page of raw.split(PAGE_BREAK)) {
        for (const p of extractFromHtmlTable(page, rule)) {
          const tld = p.tld.toLowerCase().replace(/^\./, "")
          if (!tld || seen.has(tld)) continue
          seen.add(tld)
          out.push(p)
        }
      }
      if (out.length === 0) throw new Error(`${slug} HTML 兜底解析为空`)
      return out
    },
  }
}

/** 浏览器渲染兜底策略(需 BROWSER_SERVICE_URL;extract-json 形态) */
function browserFallbackStrategy(rule: DynamicRule, slug: string): StrategyDefinition {
  return {
    type: "playwright",
    url: rule.dataUrl ?? rule.urls[0],
    browser: {
      extract: "extract-json",
      waitFor: rule.browser?.waitFor ?? undefined,
      scrollToBottom: rule.browser?.scrollToBottom ?? true,
      locale: rule.browser?.locale ?? undefined,
    },
    parse(raw): RawPrice[] {
      const rows = JSON.parse(raw) as Array<Record<string, unknown>>
      const out: RawPrice[] = []
      const seen = new Set<string>()
      for (const r of rows) {
        const tld = String(r.tld ?? "").trim().toLowerCase().replace(/^\./, "")
        if (!tld || tld === "tld" || tld === "domain" || seen.has(tld)) continue
        const num = (v: unknown): number | null =>
          typeof v === "number" ? v : v == null ? null : Number.parseFloat(String(v).replace(/[^0-9.]/g, "")) || null
        const reg = num(r.registerPrice)
        const renew = num(r.renewPrice)
        const transfer = num(r.transferPrice)
        if (reg == null && renew == null && transfer == null) continue
        const p: RawPrice = { tld, currency: rule.currency, sourceUrl: rule.dataUrl ?? rule.urls[0] }
        if (reg != null) p.registerPrice = reg
        if (renew != null) p.renewPrice = renew
        if (transfer != null) p.transferPrice = transfer
        seen.add(tld)
        out.push(p)
      }
      if (out.length === 0) throw new Error(`${slug} 浏览器提取结果为空`)
      return out
    },
  }
}

/** 组装策略链:主策略 → HTML 兜底 → 浏览器兜底(按需),自动降级 */
function buildStrategies(rule: DynamicRule, slug: string): StrategyDefinition[] {
  const strategy = ruleStrategyOf(rule)
  const strategies: StrategyDefinition[] = []

  if (strategy === "playwright") {
    strategies.push(browserFallbackStrategy(rule, slug))
    strategies.push(htmlFallbackStrategy(rule, slug))
    return strategies
  }

  // 主策略(html 也走此路径,以支持翻页)
  strategies.push({
    type: strategy,
    url: rule.dataUrl ?? rule.urls[0],
    fetch: makePaginatedFetch(rule),
    parse: makeParse(strategy, rule, slug),
  })

  // 非 html 主策略时,追加 HTML 表格兜底
  if (strategy !== "html") strategies.push(htmlFallbackStrategy(rule, slug))

  // 声明了浏览器渲染选项 → 追加浏览器兜底
  if (rule.browser) strategies.push(browserFallbackStrategy(rule, slug))

  return strategies
}

/** 用注册商基础信息 + active 动态规则构建适配器 */
export function buildDynamicAdapter(registrar: Registrar, rule: DynamicRule): BaseAdapter {
  const strategy = ruleStrategyOf(rule)
  const isPlainHtml = strategy === "html" && !rule.pagination && !rule.browser

  // 纯 HTML 表格规则:沿用 createTableAdapter(与历史行为一致)
  if (isPlainHtml) {
    return createTableAdapter({
      slug: registrar.slug,
      name: registrar.name,
      website: registrar.website,
      currency: rule.currency,
      urls: rule.urls,
      columnOrder: rule.columnOrder,
      numberFormat: rule.numberFormat,
      owner: registrar.owner ?? "AI Discovery",
      version: registrar.adapterVersion ?? "1.0.0",
      priority: registrar.priority ?? 60,
    })
  }

  // 多策略规则:直接构建带降级链的适配器
  return defineAdapter({
    slug: registrar.slug,
    name: registrar.name,
    website: registrar.website,
    owner: registrar.owner ?? "AI Discovery",
    version: registrar.adapterVersion ?? "1.0.0",
    parserVersion: "1.0.0",
    currency: rule.currency,
    priority: registrar.priority ?? 60,
    capabilities: {
      registration: true,
      renewal: true,
      transfer: true,
      supportedCurrencies: [rule.currency],
    },
    rateLimit: { concurrency: 1, rpm: 10, retries: 2, timeoutMs: 60_000 },
    strategies: buildStrategies(rule, registrar.slug),
  })
}
