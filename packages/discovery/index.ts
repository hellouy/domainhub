/**
 * 通用数据源发现引擎 —— 统一入口
 *
 * 所有权：Platform Team
 * 文档：docs/adapter-sdk.md（Discovery 章节）
 *
 * 给定页面 HTML(及可选的捕获 XHR 响应)，按"真实数据源优先"的顺序自动
 * 定位并抽取域名价格，完全注册商无关：
 *
 *   1. 内嵌/捕获 JSON(__NEXT_DATA__ / __NUXT__ / ld+json / XHR 响应 …)
 *   2. Cheerio 结构化 HTML(table / dl / ul / div 网格)
 *
 * 命中 JSON 即返回，不触及 LLM。两者都拿不到时返回空，交由上层决定是否
 * 启用 LLM 兜底。目标是把 LLM 降为"最后一级"，而非主解析器。
 */

import * as cheerio from "cheerio"
import { collectJsonSources } from "./collect"
import {
  coercePrice,
  extractPricesFromJsonSources,
  type DiscoveredPrice,
  type JsonSource,
} from "./json-sources"

export type { DiscoveredPrice, JsonSource } from "./json-sources"
export { collectJsonSources } from "./collect"
export { coercePrice } from "./json-sources"

export type DiscoveryMethod = "embedded-json" | "xhr-json" | "html-structured" | "none"

export interface DiscoveryResult {
  prices: DiscoveredPrice[]
  method: DiscoveryMethod
  /** 命中的数据源标识，便于诊断(如 "__NEXT_DATA__" / "xhr:/api/pricing" / "table") */
  origin: string | null
}

export interface DiscoveryInput {
  html?: string
  /** Playwright 等捕获到的 XHR/fetch JSON 响应 */
  capturedJson?: { url: string; body: string }[]
  /** 已知币种提示 */
  currency?: string
}

const TLD_NOISE = /\b(hot|new|sale|popular|promo|best|top|deal|special|featured|热门|新|促销)\b/gi

function cleanTld(raw: string): string | null {
  let s = raw.replace(TLD_NOISE, "").replace(/\s+/g, " ").trim().toLowerCase()
  const lead = s.match(/^\.?([a-z0-9-]{2,63}(?:\.[a-z0-9-]{2,63}){0,2})\b/)
  if (!lead) return null
  return lead[1]
}

/**
 * Cheerio 结构化 HTML 解析：处理 table / dl / ul / 重复 div 卡片。
 * 通用启发式：找到大量"含 .tld 文本 + 若干价格数字"的重复单元。
 */
export function extractPricesFromHtmlStructured(
  html: string,
  currency?: string,
): DiscoveredPrice[] {
  const $ = cheerio.load(html)
  // 去除明显噪音容器
  $("script,style,noscript,svg,nav,header,footer,form,aside,iframe").remove()

  // 未显式传入币种时，从页面价格文本中尽力推断(便于探测/选择适配器币种)
  const effectiveCurrency = currency ?? detectCurrencyFromText($.root().text())

  const byTld = new Map<string, DiscoveredPrice>()

  const consider = (tldText: string, priceNums: number[]) => {
    const tld = cleanTld(tldText)
    if (!tld || byTld.has(tld)) return
    if (priceNums.length === 0) return
    // 约定：首个价格=注册，次个=续费，第三个=转入(与多数价格表一致)
    byTld.set(tld, {
      tld,
      registerPrice: priceNums[0] ?? null,
      renewPrice: priceNums[1] ?? null,
      transferPrice: priceNums[2] ?? null,
      restorePrice: null,
      currency: effectiveCurrency,
    })
  }

  const extractPriceNums = (text: string): number[] => {
    const matches = text.match(/[€$£¥]\s?\d[\d.,]*|\d[\d.,]*\s?(?:USD|EUR|GBP|CNY|元|€|\$|£|¥)/gi) ?? []
    const nums: number[] = []
    for (const m of matches) {
      const n = coercePrice(m)
      if (n != null && n > 0) nums.push(n)
    }
    // 无货币符号时退化：抓形如 12.99 的两位小数数字
    if (nums.length === 0) {
      const bare = text.match(/\b\d{1,4}[.,]\d{2}\b/g) ?? []
      for (const m of bare) {
        const n = coercePrice(m)
        if (n != null && n > 0) nums.push(n)
      }
    }
    return nums
  }

  // 1. 表格行
  $("table tr").each((_, tr) => {
    const cells = $(tr).find("td,th").map((__, c) => $(c).text().trim()).get()
    if (cells.length < 2) return
    const tldCell = cells.find((c) => cleanTld(c))
    if (!tldCell) return
    const priceNums: number[] = []
    for (const c of cells) {
      if (c === tldCell) continue
      const n = coercePrice(c)
      if (n != null && n > 0) priceNums.push(n)
    }
    consider(tldCell, priceNums)
  })

  // 2. 定义列表 dl > dt/dd
  $("dl").each((_, dl) => {
    const dts = $(dl).find("dt")
    dts.each((__, dt) => {
      const tldText = $(dt).text().trim()
      const ddText = $(dt).nextAll("dd").first().text()
      consider(tldText, extractPriceNums(ddText))
    })
  })

  // 3. 重复卡片/列表项：li 或含 tld 的 div。取每个单元内文本。
  if (byTld.size < 3) {
    $("li,[class*=price],[class*=tld],[class*=domain],[class*=card],[class*=item]").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim()
      if (text.length > 300) return // 过大容器跳过
      // 单元内第一个 .tld token
      const tldMatch = text.match(/\.[a-z]{2,24}\b/i)
      if (!tldMatch) return
      consider(tldMatch[0], extractPriceNums(text))
    })
  }

  return [...byTld.values()]
}

/**
 * 发现引擎主入口：真实数据源优先，返回抽取结果与命中方式。
 */
export function discoverPrices(input: DiscoveryInput): DiscoveryResult {
  const { html, capturedJson, currency } = input

  // 1. 捕获的 XHR JSON 响应(最可靠：这就是页面真正的数据源)
  if (capturedJson && capturedJson.length > 0) {
    const sources: JsonSource[] = []
    for (const cap of capturedJson) {
      try {
        sources.push({ origin: `xhr:${cap.url}`, data: JSON.parse(cap.body) })
      } catch {
        // 非 JSON 响应跳过
      }
    }
    const { prices, origin } = extractPricesFromJsonSources(sources)
    if (prices.length >= 3) {
      return { prices: applyCurrency(prices, currency), method: "xhr-json", origin }
    }
  }

  // 2. HTML 内嵌 JSON 源
  if (html) {
    const embedded = collectJsonSources(html)
    const { prices, origin } = extractPricesFromJsonSources(embedded)
    if (prices.length >= 3) {
      return { prices: applyCurrency(prices, currency), method: "embedded-json", origin }
    }

    // 3. Cheerio 结构化 HTML
    const structured = extractPricesFromHtmlStructured(html, currency)
    if (structured.length >= 3) {
      return { prices: structured, method: "html-structured", origin: "cheerio" }
    }
  }

  return { prices: [], method: "none", origin: null }
}

function applyCurrency(prices: DiscoveredPrice[], currency?: string): DiscoveredPrice[] {
  if (!currency) return prices
  return prices.map((p) => ({ ...p, currency: p.currency ?? currency }))
}

/**
 * 从价格文本中尽力推断币种(仅在无显式币种时用于探测/选择适配器)。
 * 优先级：显式 ISO 代码 > 明确符号。¥/￥ 在本项目上下文按出现频次择 CNY/JPY。
 * 推断不到时返回 undefined(保持 UNKNOWN，绝不臆造以免批量校验被误拒)。
 */
export function detectCurrencyFromText(text: string): string | undefined {
  if (!text) return undefined
  const t = text.slice(0, 200_000) // 扫描足够长的正文(价格表可能靠后)，正则开销可忽略
  // 1. 显式 ISO 代码(紧邻数字更可信，但出现即采信)
  const codeMatch = t.match(/\b(USD|EUR|GBP|CNY|RMB|JPY|AUD|CAD|INR|HKD|SGD)\b/)
  if (codeMatch) {
    const c = codeMatch[1].toUpperCase()
    return c === "RMB" ? "CNY" : c
  }
  // 2. 货币符号计数，取最多者(避免页面零星混入其它符号误判)
  const counts: Record<string, number> = {
    USD: (t.match(/\$/g) ?? []).length,
    EUR: (t.match(/€/g) ?? []).length,
    GBP: (t.match(/£/g) ?? []).length,
    CNY: (t.match(/[¥￥元]/g) ?? []).length,
  }
  let best: string | undefined
  let bestN = 0
  for (const [cur, n] of Object.entries(counts)) {
    if (n > bestN) {
      bestN = n
      best = cur
    }
  }
  return bestN > 0 ? best : undefined
}
