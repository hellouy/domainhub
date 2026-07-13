/**
 * 多模型回退链(Model Fallback Chain)
 * ------------------------------------------------------------
 * 所有权: Platform Team
 *
 * 修复代理不绑定任何单一模型或单一渠道。链上每个候选是
 * "渠道 + 模型" 组合,按优先级逐个尝试,失败自动降级。
 *
 * 支持的渠道(按环境变量自动启用):
 * - Vercel AI Gateway     AI_GATEWAY_API_KEY     模型 ID 形如 google/gemini-3-flash
 * - Google AI Studio 直连  GOOGLE_AI_API_KEY      免费档,OpenAI 兼容端点
 * - Groq 直连             GROQ_DIRECT_API_KEY    免费档,推理极快
 * - 智谱 BigModel 直连     ZHIPU_API_KEY          GLM-4-Flash 系列免费
 * - GitHub Models 直连     GITHUB_MODELS_TOKEN    开发调试用(额度小)
 *
 * 自定义: 环境变量 AI_REPAIR_MODELS 逗号分隔,完全覆盖默认链。
 *   条目格式  gateway:google/gemini-3-flash | google:gemini-2.5-flash
 *           | groq:llama-3.3-70b-versatile | zhipu:glm-4-flash | github:gpt-4o-mini
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { generateText, Output } from "ai"
import type { LanguageModel } from "ai"
import type { z } from "zod"

/** 渠道定义: 环境变量 + OpenAI 兼容端点 */
const CHANNELS: Record<string, { envKey: string; baseURL: string; label: string }> = {
  google: {
    envKey: "GOOGLE_AI_API_KEY",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    label: "Google AI Studio",
  },
  groq: {
    envKey: "GROQ_DIRECT_API_KEY",
    baseURL: "https://api.groq.com/openai/v1",
    label: "Groq",
  },
  zhipu: {
    envKey: "ZHIPU_API_KEY",
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    label: "智谱 BigModel",
  },
  github: {
    envKey: "GITHUB_MODELS_TOKEN",
    baseURL: "https://models.github.ai/inference",
    label: "GitHub Models",
  },
}

/** 默认链: Gateway 优先(如可用),然后按免费额度/能力排直连渠道 */
const DEFAULT_CHAIN = [
  "gateway:google/gemini-3-flash",
  "gateway:zai/glm-4.6",
  "google:gemini-2.5-flash",
  "zhipu:glm-4-flash",
  "groq:llama-3.3-70b-versatile",
  "github:gpt-4o-mini",
]

export interface ModelAttempt {
  model: string
  ok: boolean
  durationMs: number
  error?: string
}

export interface ChainResult<T> {
  output: T
  modelUsed: string
  attempts: ModelAttempt[]
}

export interface ChainEntry {
  /** 原始条目,如 "google:gemini-2.5-flash" */
  id: string
  /** 解析后的可调用模型 */
  model: LanguageModel
}

/** 解析单个链条目;渠道未配置(缺环境变量)返回 null */
function resolveEntry(entry: string): ChainEntry | null {
  const idx = entry.indexOf(":")
  const channel = idx === -1 ? "gateway" : entry.slice(0, idx)
  const modelId = idx === -1 ? entry : entry.slice(idx + 1)

  if (channel === "gateway") {
    if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) return null
    // Gateway 模型直接传字符串
    return { id: entry, model: modelId }
  }

  const ch = CHANNELS[channel]
  if (!ch) return null
  const apiKey = process.env[ch.envKey]
  if (!apiKey) return null
  const provider = createOpenAICompatible({ name: ch.label, apiKey, baseURL: ch.baseURL })
  return { id: entry, model: provider(modelId) }
}

/** 读取当前生效的模型链(仅包含已配置渠道的条目) */
export function getModelChain(): ChainEntry[] {
  const raw = process.env.AI_REPAIR_MODELS?.trim()
    ? process.env.AI_REPAIR_MODELS.split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : DEFAULT_CHAIN
  return raw.map(resolveEntry).filter((e): e is ChainEntry => e !== null)
}

/** 当前可用渠道诊断(供管理端展示) */
export function chainDiagnostics(): { entry: string; available: boolean; reason?: string }[] {
  const raw = process.env.AI_REPAIR_MODELS?.trim()
    ? process.env.AI_REPAIR_MODELS.split(",").map((s) => s.trim())
    : DEFAULT_CHAIN
  return raw.map((entry) => {
    const resolved = resolveEntry(entry)
    if (resolved) return { entry, available: true }
    const channel = entry.includes(":") ? entry.slice(0, entry.indexOf(":")) : "gateway"
    const envKey = channel === "gateway" ? "AI_GATEWAY_API_KEY" : (CHANNELS[channel]?.envKey ?? "未知渠道")
    return { entry, available: false, reason: `缺少环境变量 ${envKey}` }
  })
}

/**
 * 沿模型链执行结构化生成,直到某个模型产出通过 schema 校验的结果。
 * 任何失败(限流/超时/信用卡墙/输出不合规)都会降级到下一个候选。
 */
export async function generateWithFallback<T>(opts: {
  schema: z.ZodType<T>
  system: string
  prompt: string
  /** 单模型超时毫秒,默认 90s */
  timeoutMs?: number
  /** 覆盖模型链(测试用) */
  models?: string[]
}): Promise<ChainResult<T>> {
  const chain = opts.models
    ? opts.models.map(resolveEntry).filter((e): e is ChainEntry => e !== null)
    : getModelChain()
  if (chain.length === 0) {
    throw new Error(
      "模型链为空: 未配置任何可用渠道。请设置 AI_GATEWAY_API_KEY / GOOGLE_AI_API_KEY / ZHIPU_API_KEY / GROQ_DIRECT_API_KEY / GITHUB_MODELS_TOKEN 之一",
    )
  }
  const attempts: ModelAttempt[] = []

  for (const entry of chain) {
    const started = Date.now()
    try {
      const { output } = await generateText({
        model: entry.model,
        system: opts.system,
        prompt: opts.prompt,
        output: Output.object({ schema: opts.schema }),
        abortSignal: AbortSignal.timeout(opts.timeoutMs ?? 90_000),
      })
      attempts.push({ model: entry.id, ok: true, durationMs: Date.now() - started })
      return { output, modelUsed: entry.id, attempts }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      attempts.push({ model: entry.id, ok: false, durationMs: Date.now() - started, error: message.slice(0, 300) })
    }
  }

  throw new Error(
    `模型链全部失败(${chain.length} 个): ` + attempts.map((a) => `${a.model}: ${a.error?.slice(0, 80)}`).join(" | "),
  )
}
