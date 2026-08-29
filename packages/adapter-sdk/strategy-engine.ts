/**
 * Source Strategy Engine —— 数据源策略引擎
 *
 * 所有权：Platform Team
 * 文档：docs/adapter-sdk.md（Strategy 章节）
 *
 * 按适配器声明的优先级依次尝试策略，任一策略成功即停止；
 * 全部失败时抛出聚合错误。每次尝试记录：策略、结果、耗时、失败原因。
 */

import type {
  AdapterContext,
  RawPrice,
  StrategyAttempt,
  StrategyDefinition,
  StrategyType,
} from "./types"
import { autoParse, parsePriceString } from "../parser"

export interface StrategyExecution {
  strategy: StrategyType
  rawPrices: RawPrice[]
  attempts: StrategyAttempt[]
  /** 下载耗时（选中策略的 fetch 时间） */
  downloadMs: number
  /** 解析耗时（选中策略的 parse 时间） */
  parsingMs: number
}

/** 默认 fetch：用平台受控 fetch 拉取策略 URL 的文本 */
async function defaultFetch(def: StrategyDefinition, ctx: AdapterContext): Promise<string> {
  if (!def.url) {
    throw new Error(`策略 ${def.type} 未提供 url，也未提供自定义 fetch`)
  }
  const res = await ctx.fetch(def.url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

/** 浏览器渲染服务地址（独立部署的 Playwright worker）；未配置时 playwright 策略直接降级 */
const BROWSER_SERVICE_URL = process.env.BROWSER_SERVICE_URL ?? ""

/**
 * playwright 策略的浏览器 fetch：
 * 把渲染任务转发给浏览器服务（BROWSER_SERVICE_URL），服务端用 Playwright 打开页面、
 * 等待渲染完成并注入提取脚本，返回提取结果 JSON（extract-json）或完整 HTML（html）。
 *
 * extract-json 返回项字段已按 RawPrice 约定规范化：
 *   { tld, registerPrice, renewPrice, transferPrice, currency?, sourceUrl? }
 * 因此该形态下可以省略自定义 parse，直接走 defaultParse。
 */
async function browserStrategyFetch(def: StrategyDefinition, ctx: AdapterContext): Promise<string> {
  if (!BROWSER_SERVICE_URL) {
    throw new Error("playwright 策略需要配置环境变量 BROWSER_SERVICE_URL（浏览器渲染服务地址）")
  }
  const opts = def.browser ?? {}
  const payload = {
    url: def.url,
    extract: opts.extract ?? "extract-json",
    waitFor: opts.waitFor ?? null,
    waitForTimeoutMs: opts.waitForTimeoutMs ?? 30_000,
    scrollToBottom: opts.scrollToBottom ?? true,
    locale: opts.locale ?? null,
    headers: opts.headers ?? {},
    script: opts.script ?? null,
    captureXhrFilter: opts.captureXhrFilter ?? [],
  }
  const res = await ctx.fetch(`${BROWSER_SERVICE_URL}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`浏览器服务返回 HTTP ${res.status}`)
  const data = (await res.json()) as {
    ok?: boolean
    extracted?: unknown[]
    html?: string
    xhrResponses?: Array<{ url: string; status: number; body: string }>
    error?: string
  }
  if (!data.ok) throw new Error(data.error ?? "浏览器服务报告渲染失败")
  if (opts.extract === "html") {
    if (typeof data.html !== "string") throw new Error("浏览器服务未返回 html")
    return data.html
  }
  if (opts.extract === "xhr-json") {
    return JSON.stringify(data.xhrResponses ?? [])
  }
  return JSON.stringify(data.extracted ?? [])
}

/** 默认 parse：Parser 平台自动识别格式，要求数据已是 RawPrice 形状 */
function defaultParse(raw: string): RawPrice[] {
  const { format, data } = autoParse(raw)
  if (format === "json" && Array.isArray(data)) {
    return (data as Record<string, unknown>[]).map((row) => ({
      tld: String(row.tld ?? ""),
      registerPrice: parsePriceString(row.registerPrice as string),
      renewPrice: parsePriceString(row.renewPrice as string),
      transferPrice: parsePriceString(row.transferPrice as string),
    }))
  }
  throw new Error(
    `默认解析器无法将 ${format} 数据映射为价格行，请在策略中提供自定义 parse`,
  )
}

/**
 * 执行策略链：按优先级尝试，成功即返回，失败自动降级到下一策略。
 */
export async function executeStrategies(
  strategies: StrategyDefinition[],
  ctx: AdapterContext,
): Promise<StrategyExecution> {
  if (strategies.length === 0) {
    throw new Error("适配器未声明任何数据源策略")
  }

  const attempts: StrategyAttempt[] = []

  for (const def of strategies) {
    const started = Date.now()
    try {
      await ctx.log("info", `尝试策略 [${def.type}]${def.url ? `：${def.url}` : ""}`)

      const fetchStarted = Date.now()
      const raw = def.fetch
        ? await def.fetch(ctx)
        : def.type === "playwright"
          ? await browserStrategyFetch(def, ctx)
          : await defaultFetch(def, ctx)
      const downloadMs = Date.now() - fetchStarted

      const parseStarted = Date.now()
      const rawPrices = def.parse ? await def.parse(raw, ctx) : defaultParse(raw)
      const parsingMs = Date.now() - parseStarted

      if (rawPrices.length === 0) {
        throw new Error("解析结果为空（0 条价格）")
      }

      const latencyMs = Date.now() - started
      attempts.push({ strategy: def.type, ok: true, latencyMs })
      await ctx.log(
        "info",
        `策略 [${def.type}] 成功：${rawPrices.length} 条原始价格，耗时 ${latencyMs}ms`,
      )
      return { strategy: def.type, rawPrices, attempts, downloadMs, parsingMs }
    } catch (err) {
      const latencyMs = Date.now() - started
      const reason = err instanceof Error ? err.message : String(err)
      attempts.push({ strategy: def.type, ok: false, latencyMs, failureReason: reason })
      await ctx.log("warn", `策略 [${def.type}] 失败（${latencyMs}ms）：${reason}，降级到下一策略`)
    }
  }

  const summary = attempts
    .map((a) => `${a.strategy}: ${a.failureReason ?? "未知错误"}`)
    .join("；")
  throw new Error(`全部 ${strategies.length} 个策略均失败 —— ${summary}`)
}
