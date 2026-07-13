import "server-only"

import type { RawContent } from "@/lib/crawler/types"

/**
 * Parser 服务：HTML / JSON / XML -> 原始记录数组
 *
 * 规则：所有解析逻辑集中在此，Adapter 内部禁止出现解析代码。
 * Adapter 只声明"数据在哪、哪个字段对应什么"，把 RawContent 交给 Parser。
 */

/** 解析产物：键值记录数组，由 Adapter 的 normalize 再映射为 DomainPrice */
export type RawRecord = Record<string, unknown>

export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ParseError"
  }
}

/** JSON：对象（map 形态）转为 [{ key, ...value }]，数组原样返回 */
function parseJson(body: string): RawRecord[] {
  let data: unknown
  try {
    data = JSON.parse(body)
  } catch {
    throw new ParseError("JSON 解析失败：响应不是合法 JSON")
  }
  if (Array.isArray(data)) {
    return data.filter((v): v is RawRecord => v !== null && typeof v === "object")
  }
  if (data !== null && typeof data === "object") {
    return Object.entries(data as Record<string, unknown>).map(([key, value]) => ({
      key,
      ...(value !== null && typeof value === "object" ? (value as RawRecord) : { value }),
    }))
  }
  throw new ParseError("JSON 解析失败：期望对象或数组")
}

/** 去除 HTML 标签并解码常见实体 */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * HTML：提取第一个（或指定序号的）<table>，表头作为字段名。
 * 适合注册商定价页的静态表格；客户端渲染页面应改用 JSON 端点或预渲染数据。
 */
function parseHtmlTable(body: string, tableIndex = 0): RawRecord[] {
  const tables = body.match(/<table[\s\S]*?<\/table>/gi)
  if (!tables || !tables[tableIndex]) {
    throw new ParseError(`HTML 解析失败：未找到第 ${tableIndex + 1} 个 <table>`)
  }
  const rows = tables[tableIndex].match(/<tr[\s\S]*?<\/tr>/gi) ?? []
  if (rows.length < 2) throw new ParseError("HTML 解析失败：表格行数不足")

  const cells = (row: string) =>
    (row.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? []).map(stripTags)

  const headers = cells(rows[0] ?? "").map((h, i) => h || `col${i}`)
  return rows.slice(1).map((row) => {
    const values = cells(row)
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? null]))
  })
}

/**
 * XML：将指定标签名的每个元素转为一条记录，子元素为字段。
 * 轻量正则实现，满足定价 feed 的常见扁平结构；复杂文档可引入专用解析库替换实现，接口不变。
 */
function parseXml(body: string, recordTag: string): RawRecord[] {
  const pattern = new RegExp(`<${recordTag}(?:\\s[^>]*)?>([\\s\\S]*?)</${recordTag}>`, "gi")
  const records: RawRecord[] = []
  for (const match of body.matchAll(pattern)) {
    const inner = match[1]
    const record: RawRecord = {}
    for (const field of inner.matchAll(/<([\w:-]+)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)) {
      record[field[1]] = stripTags(field[2])
    }
    if (Object.keys(record).length > 0) records.push(record)
  }
  if (records.length === 0) {
    throw new ParseError(`XML 解析失败：未找到 <${recordTag}> 记录`)
  }
  return records
}

export interface ParseOptions {
  /** HTML：取第几个表格（默认第 1 个） */
  tableIndex?: number
  /** XML：记录元素的标签名（默认 "item"） */
  recordTag?: string
}

export class ParserService {
  /** 统一入口：按 RawContent.kind 分派 */
  parse(raw: RawContent, options: ParseOptions = {}): RawRecord[] {
    switch (raw.kind) {
      case "json":
        return parseJson(raw.body)
      case "html":
        return parseHtmlTable(raw.body, options.tableIndex ?? 0)
      case "xml":
        return parseXml(raw.body, options.recordTag ?? "item")
    }
  }
}

/** 默认单例（也可自行 new，便于测试替身注入） */
export const parserService = new ParserService()
