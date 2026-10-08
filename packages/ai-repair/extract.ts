/**
 * 策略无关的价格抽取核心
 * ------------------------------------------------------------
 * 所有权: Platform Team
 *
 * 把"一段原始数据(HTML/JSON) + 一份动态规则 → RawPrice[]"的逻辑收敛到一处,
 * 供两个调用方复用:
 *   1. services/crawl/dynamic-adapter.ts —— 采集运行时构建策略 parse
 *   2. packages/ai-repair/index.ts —— 接入/修复时的确定性验证
 *
 * 全程无 LLM,纯确定性。html 策略复用 table-adapter 的表格解析;
 * json 类策略(hydration/nuxt-payload/embedded-json/json/api)用 parser 平台
 * 提取 JSON 后按 itemsPath + fieldMap 映射。
 */

import type { RawPrice } from "@/packages/adapter-sdk"
import { extractTableRows, findTldCell, parsePrice } from "@/adapters/shared/table-adapter"
import { parseJson, parseNextData, parseNuxtPayload, parseEmbeddedJson, parsePriceString } from "@/packages/parser"
import type { DynamicRule } from "./schema"

/** 规则声明的策略,缺省按 html 处理 */
export function ruleStrategyOf(rule: DynamicRule): NonNullable<DynamicRule["strategy"]> {
  return rule.strategy ?? "html"
}

/** 数字清洗:number 直接用;字符串先按本地化格式解析,兜底再按纯数字解析 */
function toNumber(value: unknown, format: "en" | "eu" | "fr"): number | null {
  if (value == null) return null
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null
  const s = String(value)
  const byFormat = parsePrice(s, format)
  if (byFormat != null) return byFormat
  return parsePriceString(s)
}

/** 解析路径:支持 a.b.c / a.b[0].c / a.0.c */
export function resolvePath(root: unknown, path?: string): unknown {
  if (!path) return root
  const parts = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .map((p) => p.trim())
    .filter(Boolean)
  let cur: unknown = root
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

/** 深搜第一个"对象数组且首元素含 tldKey 字段"的数组(itemsPath 缺失/无效时兜底) */
function deepFindItems(root: unknown, tldKey: string, depth = 0): Record<string, unknown>[] | null {
  if (root == null || depth > 6) return null
  if (Array.isArray(root)) {
    const first = root[0]
    if (first && typeof first === "object" && !Array.isArray(first)) {
      const keys = Object.keys(first as Record<string, unknown>)
      if (keys.includes(tldKey) || keys.some((k) => /tld|extension|domain/i.test(k))) {
        return root.filter((x) => x && typeof x === "object") as Record<string, unknown>[]
      }
    }
    for (const el of root) {
      const found = deepFindItems(el, tldKey, depth + 1)
      if (found) return found
    }
    return null
  }
  if (typeof root === "object") {
    for (const v of Object.values(root as Record<string, unknown>)) {
      const found = deepFindItems(v, tldKey, depth + 1)
      if (found) return found
    }
  }
  return null
}

/** 从 JSON 根对象里定位价格项数组:先按 itemsPath,失败再深搜 */
function pickItems(root: unknown, rule: DynamicRule): Record<string, unknown>[] {
  const tldKey = rule.fieldMap?.tld ?? "tld"
  const byPath = resolvePath(root, rule.itemsPath)
  if (Array.isArray(byPath)) {
    return byPath.filter((x) => x && typeof x === "object") as Record<string, unknown>[]
  }
  return deepFindItems(root, tldKey) ?? []
}

/** JSON 价格项数组 → RawPrice[](按 fieldMap 映射) */
function mapItems(items: Record<string, unknown>[], rule: DynamicRule): RawPrice[] {
  const fm = rule.fieldMap ?? { tld: "tld", register: "register", renew: "renew", transfer: "transfer" }
  const dataUrl = rule.dataUrl ?? rule.urls[0]
  const out: RawPrice[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const rawTld = item[fm.tld]
    if (rawTld == null) continue
    const tld = String(rawTld).trim().toLowerCase().replace(/^\./, "")
    if (!tld || tld.length > 30 || seen.has(tld)) continue
    const register = fm.register ? toNumber(item[fm.register], rule.numberFormat) : null
    const renew = fm.renew ? toNumber(item[fm.renew], rule.numberFormat) : null
    const transfer = fm.transfer ? toNumber(item[fm.transfer], rule.numberFormat) : null
    const restore = fm.restore ? toNumber(item[fm.restore], rule.numberFormat) : null
    if (register == null && renew == null && transfer == null && restore == null) continue
    const price: RawPrice = { tld, currency: rule.currency, sourceUrl: dataUrl }
    if (register != null) price.registerPrice = register
    if (renew != null) price.renewPrice = renew
    if (transfer != null) price.transferPrice = transfer
    if (restore != null) price.restorePrice = restore
    seen.add(tld)
    out.push(price)
  }
  return out
}

/** HTML 表格 → RawPrice[](复用 table-adapter 的表格识别 + columnOrder 语义) */
export function extractFromHtmlTable(html: string, rule: DynamicRule): RawPrice[] {
  const rows = extractTableRows(html)
  const out: RawPrice[] = []
  const seen = new Set<string>()
  for (const cells of rows) {
    const hit = findTldCell(cells)
    if (!hit) continue
    const [tld, tldIdx] = hit
    if (seen.has(tld)) continue
    const values: (number | null)[] = []
    for (let i = tldIdx + 1; i < cells.length; i++) values.push(parsePrice(cells[i], rule.numberFormat))
    if (values.every((v) => v === null)) continue
    const price: RawPrice = { tld, currency: rule.currency, sourceUrl: rule.urls[0] }
    let vi = 0
    for (const role of rule.columnOrder) {
      if (vi >= values.length) break
      const value = values[vi]
      vi++
      if (role === "skip") continue
      if (role === "register") price.registerPrice = value
      else if (role === "renew") price.renewPrice = value
      else if (role === "transfer") price.transferPrice = value
      else if (role === "restore") price.restorePrice = value
    }
    if (price.registerPrice == null && price.renewPrice == null && price.transferPrice == null) continue
    seen.add(tld)
    out.push(price)
  }
  return out
}

/** 从原始数据里取出 JSON 根(按策略):hydration/nuxt/embedded 从 html 提取,json/api 直接 parse */
function jsonRootsForStrategy(strategy: string, raw: string): unknown[] {
  if (strategy === "hydration") return [parseNextData(raw)]
  if (strategy === "nuxt-payload") return [parseNuxtPayload(raw)]
  if (strategy === "embedded-json") return parseEmbeddedJson(raw)
  // json | api
  return [parseJson(raw)]
}

/**
 * 抽取入口:一段原始数据 + 规则 → RawPrice[]。
 * html 走表格解析;其余策略走 JSON 提取 + fieldMap 映射(embedded-json 可能多块,逐块尝试)。
 */
export function extractPricesFromRaw(strategy: string, raw: string, rule: DynamicRule): RawPrice[] {
  if (strategy === "html") return extractFromHtmlTable(raw, rule)
  const roots = jsonRootsForStrategy(strategy, raw)
  for (const root of roots) {
    const items = pickItems(root, rule)
    if (items.length) {
      const prices = mapItems(items, rule)
      if (prices.length) return prices
    }
  }
  return []
}
