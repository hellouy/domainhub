/**
 * Parser Platform —— 独立的数据解析平台
 *
 * 所有权：Platform Team
 * 文档：docs/parser.md
 *
 * 支持 JSON / HTML / Table / CSV / XML / Hydration(Next.js) /
 * Nuxt Payload / GraphQL / 内嵌 JSON。
 * autoParse 根据内容自动选择解析器；适配器也可显式调用具体解析器。
 *
 * Parser 只做「原始文本 → 结构化数据」，不包含任何注册商特定逻辑。
 * 注册商特定的字段映射在适配器的 parse 阶段完成。
 */

export const PARSER_PLATFORM_VERSION = "1.0.0"

// ============================================================
// JSON Parser
// ============================================================

/** 解析 JSON 文本，失败抛出带上下文的错误 */
export function parseJson<T = unknown>(raw: string): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new Error(`JSON 解析失败：${raw.slice(0, 120)}...`)
  }
}

// ============================================================
// CSV Parser
// ============================================================

/** 解析单行 CSV（支持引号包裹与转义引号） */
function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ",") {
      cells.push(cur)
      cur = ""
    } else {
      cur += ch
    }
  }
  cells.push(cur)
  return cells
}

/** 解析 CSV 为对象数组（首行为表头） */
export function parseCsv(raw: string): Record<string, string>[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0]).map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? "").trim()
    })
    return row
  })
}

// ============================================================
// HTML / Table Parser（无依赖的轻量实现）
// ============================================================

/** 去除 HTML 标签并解码常见实体 */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** 从 HTML 中提取所有表格，返回 [table][row][cell] 文本矩阵 */
export function parseHtmlTables(html: string): string[][][] {
  const tables: string[][][] = []
  const tableMatches = html.match(/<table[\s\S]*?<\/table>/gi) ?? []
  for (const tableHtml of tableMatches) {
    const rows: string[][] = []
    const rowMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) ?? []
    for (const rowHtml of rowMatches) {
      const cellMatches = rowHtml.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? []
      if (cellMatches.length > 0) {
        rows.push(cellMatches.map((c) => stripHtml(c)))
      }
    }
    if (rows.length > 0) tables.push(rows)
  }
  return tables
}

// ============================================================
// XML / RSS Parser（轻量实现：提取重复元素）
// ============================================================

/** 提取 XML 中指定标签的所有内容块 */
export function parseXmlElements(raw: string, tagName: string): string[] {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "gi")
  const results: string[] = []
  let m: RegExpExecArray | null
  while ((m = pattern.exec(raw)) !== null) {
    results.push(m[1])
  }
  return results
}

/** 提取 XML 元素内单个子标签的文本值 */
export function xmlValue(block: string, tagName: string): string | null {
  const m = block.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i"))
  return m ? stripHtml(m[1]) : null
}

// ============================================================
// Hydration Parser（Next.js __NEXT_DATA__ / Nuxt __NUXT__ / 内嵌 JSON）
// ============================================================

/** 提取 Next.js 页面的 __NEXT_DATA__ JSON */
export function parseNextData<T = unknown>(html: string): T {
  const m = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
  )
  if (!m) throw new Error("页面中未找到 __NEXT_DATA__（非 Next.js 水合页面）")
  return parseJson<T>(m[1])
}

/**
 * 提取 Nuxt 页面的 payload。
 * 支持 JSON 格式的 window.__NUXT__ = {...} 与 <script id="__NUXT_DATA__">。
 * 函数体格式的 payload（Nuxt 2）无法静态解析，抛错提示降级策略。
 */
export function parseNuxtPayload<T = unknown>(html: string): T {
  const dataScript = html.match(
    /<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
  )
  if (dataScript) return parseJson<T>(dataScript[1])
  const assign = html.match(/window\.__NUXT__\s*=\s*(\{[\s\S]*?\})\s*(?:;|<\/script>)/i)
  if (assign) {
    try {
      return parseJson<T>(assign[1])
    } catch {
      throw new Error("Nuxt payload 非纯 JSON（可能为函数体），请降级到 xhr/html 策略")
    }
  }
  throw new Error("页面中未找到 Nuxt payload")
}

/** 提取页面内嵌 JSON（<script type="application/json"> 或 ld+json） */
export function parseEmbeddedJson<T = unknown>(html: string, scriptId?: string): T[] {
  const pattern = scriptId
    ? new RegExp(`<script[^>]*id="${scriptId}"[^>]*>([\\s\\S]*?)</script>`, "gi")
    : /<script[^>]*type="application\/(?:ld\+)?json"[^>]*>([\s\S]*?)<\/script>/gi
  const results: T[] = []
  let m: RegExpExecArray | null
  while ((m = pattern.exec(html)) !== null) {
    try {
      results.push(parseJson<T>(m[1]))
    } catch {
      // 跳过无法解析的块
    }
  }
  return results
}

// ============================================================
// GraphQL Parser
// ============================================================

/** 解析 GraphQL 响应：校验 errors 并返回 data */
export function parseGraphqlResponse<T = unknown>(raw: string): T {
  const parsed = parseJson<{ data?: T; errors?: { message: string }[] }>(raw)
  if (parsed.errors?.length) {
    throw new Error(`GraphQL 错误：${parsed.errors.map((e) => e.message).join("; ")}`)
  }
  if (parsed.data === undefined) throw new Error("GraphQL 响应缺少 data 字段")
  return parsed.data
}

// ============================================================
// 自动解析器
// ============================================================

export type DetectedFormat = "json" | "csv" | "xml" | "html" | "unknown"

/** 根据内容特征自动检测格式 */
export function detectFormat(raw: string): DetectedFormat {
  const trimmed = raw.trimStart()
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json"
  if (/^<\?xml/i.test(trimmed) || /^<rss/i.test(trimmed)) return "xml"
  if (/^<!doctype html|^<html/i.test(trimmed) || /<table/i.test(trimmed)) return "html"
  // CSV 特征：首行含逗号且行数 > 1
  const firstLine = trimmed.split(/\r?\n/, 1)[0] ?? ""
  if (firstLine.includes(",") && trimmed.includes("\n")) return "csv"
  return "unknown"
}

/**
 * 自动解析：检测格式并返回 { format, data }。
 * json → 对象；csv → 行对象数组；html → 表格矩阵；xml → 原文（需配合 parseXmlElements）。
 */
export function autoParse(raw: string): { format: DetectedFormat; data: unknown } {
  const format = detectFormat(raw)
  switch (format) {
    case "json":
      return { format, data: parseJson(raw) }
    case "csv":
      return { format, data: parseCsv(raw) }
    case "html":
      return { format, data: parseHtmlTables(raw) }
    case "xml":
      return { format, data: raw }
    default:
      throw new Error("无法自动识别数据格式，请在策略中提供自定义 parse")
  }
}

/** 解析价格字符串："$10.88" / "10.88 USD" / "¥72" → 数字；"--"/"-"/空 → null */
export function parsePriceString(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null
  const cleaned = value.replace(/[^0-9.]/g, "")
  if (!cleaned) return null
  const num = Number.parseFloat(cleaned)
  return Number.isFinite(num) && num >= 0 ? num : null
}
