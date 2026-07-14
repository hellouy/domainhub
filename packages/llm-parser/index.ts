/**
 * @domainhub/llm-parser —— LLM 兜底价格解析器
 *
 * 所有权：Platform Team
 * 文档：docs/adapter-sdk.md（LLM Fallback 章节）
 *
 * 用途：当传统 html/table 策略解析出 0 条价格时（页面价格不在标准 <table>
 * 里，如卡片/列表布局），把清洗后的 HTML 交给 LLM 按固定 schema 抽取价格。
 * 只在解析为空时才调用，杜绝无谓 token 消耗。
 *
 * 接入：直连智谱 GLM（OpenAI 兼容端点）。
 * 环境变量：
 * - ZHIPU_API_KEY        —— 智谱 API key（必需，未配置时抛 LlmNotConfiguredError）
 * - ZHIPU_BASE_URL       —— 兼容端点，默认 https://open.bigmodel.cn/api/paas/v4
 * - ZHIPU_MODEL          —— 模型 ID，默认 glm-4-flash
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { generateText } from "ai"

/** LLM 未配置错误：供策略引擎捕获并降级/跳过 */
export class LlmNotConfiguredError extends Error {
  constructor(message = "未配置 ZHIPU_API_KEY，LLM 兜底解析不可用") {
    super(message)
    this.name = "LlmNotConfiguredError"
  }
}

const DEFAULT_BASE_URL = "https://open.bigmodel.cn/api/paas/v4"
const DEFAULT_MODEL = "glm-4.7-flash"

/** LLM 抽取出的单条价格（与 RawPrice 对齐的子集） */
export type LlmPriceRow = {
  tld: string
  registerPrice: number | null
  renewPrice: number | null
  transferPrice: number | null
}

export type LlmExtraction = {
  currency: string
  prices: LlmPriceRow[]
}

let cachedModelKey = ""
let cachedModel: ReturnType<ReturnType<typeof createOpenAICompatible>["chatModel"]> | null = null

/** 按环境变量解析智谱模型；未配置 key 时抛 LlmNotConfiguredError */
function resolveModel() {
  const apiKey = process.env.ZHIPU_API_KEY
  if (!apiKey) throw new LlmNotConfiguredError()

  const baseURL = process.env.ZHIPU_BASE_URL || DEFAULT_BASE_URL
  const modelId = process.env.ZHIPU_MODEL || DEFAULT_MODEL
  const key = `${baseURL}|${modelId}|${apiKey.slice(0, 6)}`
  if (cachedModel && cachedModelKey === key) return cachedModel

  const provider = createOpenAICompatible({
    name: "zhipu",
    apiKey,
    baseURL,
  })
  cachedModel = provider.chatModel(modelId)
  cachedModelKey = key
  return cachedModel
}

/** 是否已配置 LLM（供调用方在构建策略链时判断是否追加兜底策略） */
export function isLlmConfigured(): boolean {
  return Boolean(process.env.ZHIPU_API_KEY)
}

/**
 * 清洗 HTML：剥离 script/style/head、压缩空白，控制体积以省 token。
 * 只保留 body 可见结构，价格数据通常在其中。
 */
export function cleanHtmlForLlm(html: string, maxChars = 40_000): string {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<(nav|header|footer|aside|form|iframe|noscript)[\s\S]*?<\/\1>/gi, " ")
    // 剥离所有标签属性(class/style/data-* 等)——它们占满 token 预算却无价格信息，
    // 只保留标签名本身以维持结构
    .replace(/<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, "<$1>")
    // 折叠连续的开闭标签噪音
    .replace(/(<\/?[a-zA-Z][a-zA-Z0-9]*>\s*){3,}/g, (m) => m.replace(/\s+/g, ""))
    .replace(/\s+/g, " ")
    .trim()
  // 优先保留含价格符号/数字的区段：若超长，从首个价格特征附近截取
  if (s.length > maxChars) {
    const anchor = s.search(/[€$£¥]|\d+[.,]\d{2}/)
    const start = anchor > 2000 ? anchor - 2000 : 0
    s = s.slice(start, start + maxChars)
  }
  return s
}

/**
 * 用 LLM 从 HTML 中抽取价格。仅在传统解析为空时调用。
 * @param html   原始或清洗后的 HTML
 * @param hint   可选提示（注册商名、货币等），提升准确率
 */
export async function extractPricesWithLlm(
  html: string,
  hint?: { registrar?: string; currency?: string; sourceUrl?: string },
): Promise<LlmExtraction> {
  const model = resolveModel()
  const content = cleanHtmlForLlm(html)

  const system =
    "你是一个域名价格数据抽取器。从给定的注册商价格页 HTML 中提取每个顶级后缀（TLD）的" +
    "注册价、续费价、转入价。只输出确实出现在页面中的数据，不要臆造或估算。" +
    "价格必须是纯数字（去掉货币符号、千分位、货币代码）。找不到的字段填 null。" +
    "忽略与域名价格无关的内容（导航、页脚、广告）。\n" +
    "严格只输出一个 JSON 对象，格式为：" +
    '{"currency":"EUR","prices":[{"tld":"com","registerPrice":9.99,"renewPrice":12.99,"transferPrice":9.99}]}。' +
    "currency 用 ISO 4217 代码，无法判断填 UNKNOWN。不要输出 JSON 以外的任何文字。"

  const prompt =
    (hint?.registrar ? `注册商：${hint.registrar}\n` : "") +
    (hint?.currency ? `预期货币：${hint.currency}\n` : "") +
    (hint?.sourceUrl ? `来源：${hint.sourceUrl}\n` : "") +
    `\n以下是价格页 HTML（已清洗）：\n${content}`

  const { text } = await generateText({
    model,
    system,
    prompt,
    // 智谱 GLM 支持 json_object 强制返回 JSON；但不保证严格字段名，故手动宽松解析
    providerOptions: { zhipu: { response_format: { type: "json_object" } } },
  })

  return parseLlmJson(text, hint?.currency)
}

/** 从任意值里提取数字（去货币符号/千分位/货币代码） */
function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v !== "string") return null
  const m = v.replace(/[^\d.,]/g, "").replace(/,(?=\d{3}\b)/g, "").replace(/,/g, ".")
  const n = Number.parseFloat(m)
  return Number.isFinite(n) ? n : null
}

/** 取对象里第一个存在的字段（容错 LLM 的字段名变体） */
function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    for (const actual of Object.keys(obj)) {
      if (actual.toLowerCase() === k.toLowerCase()) return obj[actual]
    }
  }
  return undefined
}

/**
 * 宽松解析 LLM 返回的 JSON：容忍 markdown 代码块包裹、字段名变体
 * （renewalPrice/renewal/renew 等）、价格为字符串等情况。
 */
export function parseLlmJson(text: string, fallbackCurrency?: string): LlmExtraction {
  let jsonStr = text.trim()
  // 去掉可能的 ```json ... ``` 包裹
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) jsonStr = fence[1].trim()
  // 截取第一个 { 到最后一个 }
  const start = jsonStr.indexOf("{")
  const end = jsonStr.lastIndexOf("}")
  if (start >= 0 && end > start) jsonStr = jsonStr.slice(start, end + 1)

  let data: Record<string, unknown>
  try {
    data = JSON.parse(jsonStr) as Record<string, unknown>
  } catch {
    throw new Error("LLM 返回的内容不是合法 JSON")
  }

  const rawRows = pick(data, ["prices", "data", "items", "results"])
  const arr = Array.isArray(rawRows) ? rawRows : []
  const currencyRaw = pick(data, ["currency", "curr", "ccy"])
  const currency =
    typeof currencyRaw === "string" && currencyRaw.trim() && currencyRaw.toUpperCase() !== "UNKNOWN"
      ? currencyRaw.trim().toUpperCase()
      : (fallbackCurrency ?? "UNKNOWN")

  const prices: LlmPriceRow[] = []
  for (const item of arr) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    const tldRaw = pick(o, ["tld", "extension", "suffix", "domain"])
    if (typeof tldRaw !== "string" || !tldRaw.trim()) continue
    prices.push({
      tld: tldRaw.trim(),
      registerPrice: toNumber(pick(o, ["registerPrice", "register", "registration", "reg", "new", "price"])),
      renewPrice: toNumber(pick(o, ["renewPrice", "renewalPrice", "renewal", "renew"])),
      transferPrice: toNumber(pick(o, ["transferPrice", "transfer"])),
    })
  }

  return { currency, prices }
}
