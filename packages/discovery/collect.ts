/**
 * 内嵌 JSON 源收集 —— 从 HTML 中提取所有可静态解析的 JSON 数据源
 *
 * 所有权：Platform Team
 *
 * 覆盖：__NEXT_DATA__ / __NUXT_DATA__ / window.__NUXT__ /
 * window.__INITIAL_STATE__ / window.__APOLLO_STATE__ / ld+json /
 * 任意 <script type="application/json"> / 常见 window.X = {...} 赋值。
 */

import type { JsonSource } from "./json-sources"

/** 安全 JSON.parse，失败返回 undefined */
function tryParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/** 抓取从某位置开始的第一个平衡的 {...} 或 [...] 块 */
function extractBalanced(s: string, startIdx: number): string | null {
  const open = s[startIdx]
  const close = open === "{" ? "}" : open === "[" ? "]" : ""
  if (!close) return null
  let depth = 0
  let inStr = false
  let strCh = ""
  let escaped = false
  for (let i = startIdx; i < s.length; i++) {
    const ch = s[i]
    if (inStr) {
      if (escaped) escaped = false
      else if (ch === "\\") escaped = true
      else if (ch === strCh) inStr = false
      continue
    }
    if (ch === '"' || ch === "'") { inStr = true; strCh = ch; continue }
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return s.slice(startIdx, i + 1)
    }
  }
  return null
}

/** 收集 HTML 中所有内嵌 JSON 数据源 */
export function collectJsonSources(html: string): JsonSource[] {
  const sources: JsonSource[] = []
  const add = (origin: string, raw: string | undefined) => {
    if (!raw) return
    const data = tryParse(raw.trim())
    if (data && typeof data === "object") sources.push({ origin, data })
  }

  // 1. <script id="__NEXT_DATA__">
  const next = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
  if (next) add("__NEXT_DATA__", next[1])

  // 2. <script id="__NUXT_DATA__">
  const nuxtData = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
  if (nuxtData) add("__NUXT_DATA__", nuxtData[1])

  // 3. window.X = {...} / var X = {...} 赋值(常见 hydration 全局)
  const globals = ["__NUXT__", "__INITIAL_STATE__", "__APOLLO_STATE__", "__PRELOADED_STATE__", "__data", "__STATE__"]
  for (const g of globals) {
    const re = new RegExp(`(?:window\\.|var\\s+|const\\s+|let\\s+)${g.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=\\s*`, "i")
    const m = re.exec(html)
    if (m) {
      const startIdx = m.index + m[0].length
      const brace = html.indexOf("{", startIdx) === startIdx ? startIdx : html.indexOf("[", startIdx) === startIdx ? startIdx : -1
      // 允许赋值后紧跟空白
      const realStart = /[[{]/.test(html[startIdx]) ? startIdx : (() => {
        let j = startIdx
        while (j < html.length && /\s/.test(html[j])) j++
        return /[[{]/.test(html[j]) ? j : -1
      })()
      if (realStart >= 0) {
        const block = extractBalanced(html, realStart)
        add(`window.${g}`, block ?? undefined)
      }
    }
  }

  // 4. ld+json 与任意 application/json script 块
  const scriptRe = /<script[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi
  let sm: RegExpExecArray | null
  let idx = 0
  while ((sm = scriptRe.exec(html)) !== null) {
    add(`script-json[${idx++}]`, sm[1])
  }

  return sources
}
