/**
 * JSON 数据源收集与提价 —— 通用数据源发现引擎的 JSON 部分
 *
 * 所有权：Platform Team
 *
 * 职责：从页面 HTML(及捕获的 XHR 响应)中收集所有内嵌 JSON 数据源，
 * 递归遍历 JSON 树，自动定位"后缀 + 价格"数组并抽取为 DiscoveredPrice[]。
 *
 * 设计原则：注册商无关。不含任何单站特定逻辑，靠字段名启发式识别，
 * 因此对绝大多数 Next.js/Nuxt/SPA/GraphQL 价格页开箱即用。
 */

/** 发现引擎抽取的单条价格(与 adapter-sdk 的 RawPrice 兼容子集) */
export interface DiscoveredPrice {
  tld: string
  registerPrice: number | null
  renewPrice: number | null
  transferPrice: number | null
  restorePrice: number | null
  currency?: string
}

/** 一个内嵌 JSON 数据源 */
export interface JsonSource {
  /** 来源标识，如 "__NEXT_DATA__"、"ld+json"、"window.__NUXT__"、"xhr:/api/prices" */
  origin: string
  data: unknown
}

// ---- 字段名启发式 ----

const TLD_KEYS = [
  "tld", "extension", "ext", "suffix", "domain", "domainextension", "tldname",
  "zone", "label", "name", "title", "text",
]
const REGISTER_KEYS = [
  "register", "registration", "registerprice", "reg", "new", "newprice",
  "create", "createprice", "price", "cost", "amount", "registrationprice",
]
const RENEW_KEYS = ["renew", "renewal", "renewprice", "renewalprice", "renewalfee"]
const TRANSFER_KEYS = ["transfer", "transferprice", "transferfee"]
const RESTORE_KEYS = ["restore", "restoreprice", "redemption", "redemptionprice"]

const norm = (s: string) => s.toLowerCase().replace(/[_\s-]/g, "")

/** 值是否像一个 TLD(接受 "com" / ".com" / "co.uk"，排除完整域名/句子) */
function looksLikeTld(v: unknown): string | null {
  if (typeof v !== "string") return null
  let s = v.trim().toLowerCase().replace(/^\./, "")
  if (!s || s.length > 63) return null
  // 允许字母数字与连字符，最多两级(co.uk)
  if (!/^[a-z0-9-]{2,63}(?:\.[a-z0-9-]{2,63}){0,2}$/.test(s)) return null
  // 排除看起来像完整二级域名的(如 example.com 中的 example)——纯启发式：
  // 含点时最后一段应是常见 TLD 长度(<=24)且首段不过长
  if (s.includes(".")) {
    const parts = s.split(".")
    if (parts.length > 3) return null
  }
  return s
}

/** 从任意值提取数字价格(去货币符号/千分位)，非法返回 null */
export function coercePrice(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 && v < 1_000_000 ? round2(v) : null
  if (typeof v === "object") {
    // 常见嵌套：{ amount: 9.99 } / { value: "9.99" } / { price: 9.99 }
    const o = v as Record<string, unknown>
    for (const k of ["amount", "value", "price", "cost", "current", "sale"]) {
      if (k in o) {
        const n = coercePrice(o[k])
        if (n != null) return n
      }
    }
    return null
  }
  if (typeof v !== "string") return null
  const cleaned = v.replace(/[^\d.,]/g, "").replace(/,(?=\d{3}\b)/g, "").replace(/,/g, ".")
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) && n >= 0 && n < 1_000_000 ? round2(n) : null
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** 在对象里按候选键名(归一化匹配)取第一个存在的值 */
function pickByKeys(obj: Record<string, unknown>, keys: string[]): unknown {
  const normalizedKeys = new Set(keys.map(norm))
  for (const actual of Object.keys(obj)) {
    if (normalizedKeys.has(norm(actual))) return obj[actual]
  }
  return undefined
}

/**
 * 把一个对象尝试解释为一条价格记录。
 * 成功需：能找到 TLD + 至少一个价格字段。
 */
function objToPrice(obj: Record<string, unknown>): DiscoveredPrice | null {
  // TLD：先找明确的 tld 类键，其值需 looksLikeTld
  let tld: string | null = null
  for (const key of TLD_KEYS) {
    const raw = pickByKeys(obj, [key])
    const t = looksLikeTld(raw)
    if (t) { tld = t; break }
  }
  if (!tld) return null

  // 价格字段。可能直接在对象上，或在嵌套的 prices/pricing 对象里
  let priceHost: Record<string, unknown> = obj
  const nested = pickByKeys(obj, ["prices", "pricing", "price", "cost", "fees", "rates"])
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    priceHost = { ...obj, ...(nested as Record<string, unknown>) }
  }

  const registerPrice = coercePrice(pickByKeys(priceHost, REGISTER_KEYS))
  const renewPrice = coercePrice(pickByKeys(priceHost, RENEW_KEYS))
  const transferPrice = coercePrice(pickByKeys(priceHost, TRANSFER_KEYS))
  const restorePrice = coercePrice(pickByKeys(priceHost, RESTORE_KEYS))

  if (registerPrice == null && renewPrice == null && transferPrice == null && restorePrice == null) {
    return null
  }
  const currencyRaw = pickByKeys(priceHost, ["currency", "curr", "ccy", "currencycode"])
  const currency = typeof currencyRaw === "string" ? currencyRaw.trim().toUpperCase() : undefined
  return { tld, registerPrice, renewPrice, transferPrice, restorePrice, currency }
}

/**
 * 递归遍历 JSON 树，收集所有"价格数组候选"。
 * 返回按抽取条数降序的候选组，[0] 即最可能的价格数组。
 */
function findPriceArrays(root: unknown): DiscoveredPrice[][] {
  const candidates: DiscoveredPrice[][] = []
  const seen = new Set<unknown>()

  const visit = (node: unknown, depth: number) => {
    if (!node || typeof node !== "object" || depth > 12) return
    if (seen.has(node)) return
    seen.add(node)

    if (Array.isArray(node)) {
      // 尝试把整个数组解释为价格行集合
      const rows: DiscoveredPrice[] = []
      const byTld = new Map<string, DiscoveredPrice>()
      for (const item of node) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const p = objToPrice(item as Record<string, unknown>)
          if (p && !byTld.has(p.tld)) {
            byTld.set(p.tld, p)
            rows.push(p)
          }
        }
      }
      // 至少 3 条才算一个可信的价格数组
      if (rows.length >= 3) candidates.push(rows)
      // 继续深入元素(可能是分组结构)
      for (const item of node) visit(item, depth + 1)
      return
    }

    // 对象：也可能是 { com: {register:..}, net: {...} } 的映射结构
    const obj = node as Record<string, unknown>
    const mapRows: DiscoveredPrice[] = []
    for (const [k, v] of Object.entries(obj)) {
      const t = looksLikeTld(k)
      if (t && v && typeof v === "object" && !Array.isArray(v)) {
        const p = objToPrice({ tld: k, ...(v as Record<string, unknown>) })
        if (p) mapRows.push(p)
      }
    }
    if (mapRows.length >= 3) candidates.push(mapRows)

    for (const v of Object.values(obj)) visit(v, depth + 1)
  }

  visit(root, 0)
  candidates.sort((a, b) => b.length - a.length)
  return candidates
}

/** 从一组 JSON 源里抽取最佳价格数组(条数最多者) */
export function extractPricesFromJsonSources(sources: JsonSource[]): {
  prices: DiscoveredPrice[]
  origin: string | null
} {
  let best: DiscoveredPrice[] = []
  let bestOrigin: string | null = null
  for (const src of sources) {
    const arrays = findPriceArrays(src.data)
    if (arrays.length > 0 && arrays[0].length > best.length) {
      best = arrays[0]
      bestOrigin = src.origin
    }
  }
  return { prices: best, origin: bestOrigin }
}
