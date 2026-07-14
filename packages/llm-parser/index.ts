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
import { generateText, Output } from "ai"
import { z } from "zod"

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
const priceRowSchema = z.object({
  tld: z.string().describe("后缀，带点或不带点均可，如 .com 或 com"),
  registerPrice: z.number().nullable().describe("注册价，纯数字，无货币符号；无则 null"),
  renewPrice: z.number().nullable().describe("续费价，纯数字；无则 null"),
  transferPrice: z.number().nullable().describe("转入价，纯数字；无则 null"),
})

const extractionSchema = z.object({
  currency: z.string().describe("整页价格的 ISO 4217 货币代码，如 USD/EUR/CNY；无法判断填 UNKNOWN"),
  prices: z.array(priceRowSchema).describe("页面中所有后缀的价格行"),
})

export type LlmPriceRow = z.infer<typeof priceRowSchema>
export type LlmExtraction = z.infer<typeof extractionSchema>

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
export function cleanHtmlForLlm(html: string, maxChars = 24_000): string {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
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
    "忽略与域名价格无关的内容（导航、页脚、广告）。"

  const prompt =
    (hint?.registrar ? `注册商：${hint.registrar}\n` : "") +
    (hint?.currency ? `预期货币：${hint.currency}\n` : "") +
    (hint?.sourceUrl ? `来源：${hint.sourceUrl}\n` : "") +
    `\n以下是价格页 HTML（已清洗）：\n${content}`

  const { output } = await generateText({
    model,
    system,
    prompt,
    output: Output.object({ schema: extractionSchema }),
  })

  return output
}
