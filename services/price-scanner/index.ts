/**
 * Price Page Scanner —— 价格页策略探测器
 * ------------------------------------------------------------
 * 所有权: Platform Team
 *
 * 对一个已知的价格页 URL,确定性地探测"用哪种数据源策略能取到价格":
 *   html / hydration(__NEXT_DATA__) / nuxt-payload(__NUXT__) /
 *   embedded-json(<script type=application/json|ld+json>) /
 *   xhr / graphql(从页面脚本里发现的内部端点)
 *
 * 产出建议策略 + 候选端点,供 ai-repair 生成规则或人工接入时参考。
 * 与 Discovery Engine 分工:Discovery 判断"这是不是注册商价格页",
 * Scanner 判断"这页的数据怎么取"。全程无 LLM,零成本。
 */

import type { StrategyType } from "@/packages/adapter-sdk"
import { extractTableRows, findTldCell, parsePrice } from "@/adapters/shared/table-adapter"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
const FETCH_TIMEOUT_MS = 20_000
const SNAPSHOT_LIMIT = 400_000

/** 单策略探测信号 */
export interface StrategySignal {
  strategy: StrategyType
  /** 是否检测到该策略可用的价格数据/端点 */
  detected: boolean
  /** 信号强度 0-100 */
  strength: number
  /** 相关端点/说明 */
  detail: string
}

export interface ScanResult {
  url: string
  ok: boolean
  status?: number
  /** 建议优先使用的策略(信号最强者);无信号为 null */
  suggestedStrategy: StrategyType | null
  signals: StrategySignal[]
  /** 发现的候选端点(相对/绝对) */
  endpoints: { api: string[]; xhr: string[]; graphql: string[] }
  message: string
}

async function fetchText(url: string): Promise<{ text: string; status: number } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    })
    const text = res.ok ? await res.text() : ""
    return { text: text.length > SNAPSHOT_LIMIT ? text.slice(0, SNAPSHOT_LIMIT) : text, status: res.status }
  } catch {
    return null
  }
}

/** 统计 HTML 表格里 TLD+价格 行数 */
function htmlPriceRows(html: string): number {
  const rows = extractTableRows(html)
  const seen = new Set<string>()
  for (const cells of rows) {
    const hit = findTldCell(cells)
    if (!hit) continue
    const [tld, tldIdx] = hit
    if (seen.has(tld)) continue
    for (let i = tldIdx + 1; i < cells.length; i++) {
      if (parsePrice(cells[i]) !== null) {
        seen.add(tld)
        break
      }
    }
  }
  return seen.size
}

/** JSON 文本里是否有价格样特征(含 tld 键 + 价格样数字/键) */
function jsonHasPriceSignal(jsonText: string): boolean {
  const hasTldKey = /"(tld|extension|domain|name)"\s*:/i.test(jsonText)
  const hasPriceKey = /"(price|register|renew|renewal|transfer|amount|cost|registration)"\s*:/i.test(jsonText)
  const hasDottedTld = /"\.?[a-z]{2,10}"\s*:/.test(jsonText)
  return (hasTldKey && hasPriceKey) || (hasDottedTld && hasPriceKey)
}

/** 提取 <script id=__NEXT_DATA__> 内容 */
function extractNextData(html: string): string | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
  return m ? m[1] : null
}

/** 提取 window.__NUXT__ 赋值内容 */
function extractNuxt(html: string): string | null {
  const m = html.match(/window\.__NUXT__\s*=\s*([\s\S]*?)<\/script>/i)
  return m ? m[1] : null
}

/** 提取 <script type="application/json" | "application/ld+json"> 内容片段 */
function extractEmbeddedJson(html: string): string[] {
  const out: string[] = []
  const re = /<script[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    out.push(m[1])
    if (out.length >= 20) break
  }
  return out
}

/** 从页面脚本/属性里发现 api / xhr / graphql 端点(启发式) */
function discoverEndpoints(html: string): { api: string[]; xhr: string[]; graphql: string[] } {
  const api = new Set<string>()
  const xhr = new Set<string>()
  const graphql = new Set<string>()
  const urlRe = /["'`](\/[a-z0-9._\-/]*(?:api|pricing|prices|domains?|tld)[a-z0-9._\-/]*)["'`]/gi
  let m: RegExpExecArray | null
  while ((m = urlRe.exec(html)) !== null) {
    const path = m[1]
    if (/graphql/i.test(path)) graphql.add(path)
    else if (/\/api\//i.test(path) || /\bapi\b/i.test(path)) api.add(path)
    else xhr.add(path)
    if (api.size + xhr.size + graphql.size >= 30) break
  }
  if (/graphql/i.test(html)) {
    const gm = html.match(/["'`](https?:\/\/[^"'`]*graphql[^"'`]*)["'`]/i)
    if (gm) graphql.add(gm[1])
  }
  return { api: [...api].slice(0, 10), xhr: [...xhr].slice(0, 10), graphql: [...graphql].slice(0, 10) }
}

/**
 * 扫描一个价格页,判断用哪种策略能取到价格。
 */
export async function scanPricePage(url: string): Promise<ScanResult> {
  const fetched = await fetchText(url)
  if (!fetched) {
    return {
      url, ok: false, suggestedStrategy: null, signals: [],
      endpoints: { api: [], xhr: [], graphql: [] },
      message: "抓取失败(超时/网络错误/反爬拦截)",
    }
  }
  const { text: html, status } = fetched
  if (status < 200 || status >= 400 || !html) {
    return {
      url, ok: false, status, suggestedStrategy: null, signals: [],
      endpoints: { api: [], xhr: [], graphql: [] },
      message: `HTTP ${status},无有效内容`,
    }
  }

  const signals: StrategySignal[] = []

  // 1. HTML 表格
  const rows = htmlPriceRows(html)
  signals.push({
    strategy: "html",
    detected: rows >= 1,
    strength: rows >= 15 ? 90 : rows >= 5 ? 65 : rows >= 1 ? 30 : 0,
    detail: rows > 0 ? `HTML 表格解析到 ${rows} 个 TLD+价格行` : "未发现价格表格",
  })

  // 2. hydration(__NEXT_DATA__)
  const nextData = extractNextData(html)
  if (nextData) {
    const has = jsonHasPriceSignal(nextData)
    signals.push({
      strategy: "hydration",
      detected: has,
      strength: has ? 80 : 20,
      detail: has ? "__NEXT_DATA__ 含价格特征" : "存在 __NEXT_DATA__ 但未见明显价格键",
    })
  }

  // 3. nuxt-payload(__NUXT__)
  const nuxt = extractNuxt(html)
  if (nuxt) {
    const has = jsonHasPriceSignal(nuxt)
    signals.push({
      strategy: "nuxt-payload",
      detected: has,
      strength: has ? 78 : 18,
      detail: has ? "__NUXT__ payload 含价格特征" : "存在 __NUXT__ 但未见明显价格键",
    })
  }

  // 4. embedded-json
  const embedded = extractEmbeddedJson(html)
  const embeddedHit = embedded.some((j) => jsonHasPriceSignal(j))
  if (embedded.length > 0) {
    signals.push({
      strategy: "embedded-json",
      detected: embeddedHit,
      strength: embeddedHit ? 70 : 15,
      detail: embeddedHit ? `内嵌 JSON(${embedded.length} 块)含价格特征` : `${embedded.length} 块内嵌 JSON,未见价格特征`,
    })
  }

  // 5. 端点发现(api/xhr/graphql)
  const endpoints = discoverEndpoints(html)
  if (endpoints.api.length > 0) {
    signals.push({ strategy: "api", detected: true, strength: 50, detail: `发现 ${endpoints.api.length} 个疑似 API 路径` })
  }
  if (endpoints.graphql.length > 0) {
    signals.push({ strategy: "graphql", detected: true, strength: 48, detail: `发现 GraphQL 端点` })
  }
  if (endpoints.xhr.length > 0) {
    signals.push({ strategy: "xhr", detected: true, strength: 35, detail: `发现 ${endpoints.xhr.length} 个疑似 XHR 路径` })
  }

  const ranked = [...signals].filter((s) => s.detected).sort((a, b) => b.strength - a.strength)
  const suggestedStrategy = ranked[0]?.strategy ?? null

  return {
    url, ok: true, status,
    suggestedStrategy,
    signals,
    endpoints,
    message: suggestedStrategy
      ? `建议策略: ${suggestedStrategy}(${ranked[0].detail})`
      : "未探测到可用价格数据(可能需 JS 渲染/凭证/官方 API)",
  }
}
