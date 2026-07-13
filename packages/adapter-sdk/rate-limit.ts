/**
 * Rate Limit Manager —— 按注册商的限流、重试、退避、超时、抖动与熔断
 *
 * 所有权：Platform Team
 * 文档：docs/adapter-sdk.md（Rate Limit 章节）
 */

import type { RateLimitConfig } from "./types"

interface ResolvedConfig {
  concurrency: number
  rpm: number
  retries: number
  backoffMs: number
  timeoutMs: number
  jitter: number
  circuitBreakerThreshold: number
  circuitBreakerCooldownMs: number
}

const DEFAULTS: ResolvedConfig = {
  concurrency: 2,
  rpm: 30,
  retries: 3,
  backoffMs: 1000,
  timeoutMs: 60_000,
  jitter: 0.2,
  circuitBreakerThreshold: 5,
  circuitBreakerCooldownMs: 300_000,
}

interface LimiterState {
  config: ResolvedConfig
  active: number
  /** 最近 60s 的请求时间戳 */
  windowTimestamps: number[]
  consecutiveFailures: number
  circuitOpenUntil: number
}

/** 模块级状态：按注册商 slug 隔离 */
const limiters = new Map<string, LimiterState>()

function getState(slug: string, config?: RateLimitConfig): LimiterState {
  let s = limiters.get(slug)
  if (!s) {
    s = {
      config: { ...DEFAULTS, ...config },
      active: 0,
      windowTimestamps: [],
      consecutiveFailures: 0,
      circuitOpenUntil: 0,
    }
    limiters.set(slug, s)
  } else if (config) {
    s.config = { ...DEFAULTS, ...config }
  }
  return s
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 计算带抖动的指数退避时长 */
function backoffDelay(attempt: number, cfg: ResolvedConfig): number {
  const base = cfg.backoffMs * 2 ** (attempt - 1)
  const jitter = base * cfg.jitter * Math.random()
  return Math.round(base + jitter)
}

/** 等待并发与 RPM 空位 */
async function acquireSlot(state: LimiterState): Promise<void> {
  // 最多等 5 分钟，防死锁
  const deadline = Date.now() + 300_000
  for (;;) {
    const now = Date.now()
    state.windowTimestamps = state.windowTimestamps.filter((t) => now - t < 60_000)
    if (state.active < state.config.concurrency && state.windowTimestamps.length < state.config.rpm) {
      state.active++
      state.windowTimestamps.push(now)
      return
    }
    if (now > deadline) throw new Error("限流等待超时（5 分钟）")
    await sleep(250)
  }
}

export class CircuitOpenError extends Error {
  constructor(slug: string, until: number) {
    super(`熔断器已打开（${slug}），冷却至 ${new Date(until).toISOString()}`)
    this.name = "CircuitOpenError"
  }
}

/**
 * 受控 fetch：限流 + 超时 + 重试 + 指数退避 + 抖动 + 熔断。
 * 适配器内所有网络请求必须经过它（由 AdapterContext.fetch 注入）。
 */
export async function rateLimitedFetch(
  slug: string,
  url: string,
  init?: RequestInit,
  config?: RateLimitConfig,
  onRetry?: () => void,
): Promise<Response> {
  const state = getState(slug, config)
  const cfg = state.config

  if (Date.now() < state.circuitOpenUntil) {
    throw new CircuitOpenError(slug, state.circuitOpenUntil)
  }

  let lastError: Error | null = null
  for (let attempt = 1; attempt <= cfg.retries; attempt++) {
    await acquireSlot(state)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs)
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          "User-Agent": "DomainHub/2.0 (registrar intelligence platform)",
          ...((init?.headers as Record<string, string>) ?? {}),
        },
        cache: "no-store",
      })
      // 5xx / 429 视为可重试失败
      if (res.status >= 500 || res.status === 429) {
        throw new Error(`HTTP ${res.status}`)
      }
      state.consecutiveFailures = 0
      return res
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (lastError.name === "AbortError") {
        lastError = new Error(`请求超时（${cfg.timeoutMs / 1000}s）`)
      }
      state.consecutiveFailures++
      if (state.consecutiveFailures >= cfg.circuitBreakerThreshold) {
        state.circuitOpenUntil = Date.now() + cfg.circuitBreakerCooldownMs
      }
      if (attempt < cfg.retries) {
        onRetry?.()
        await sleep(backoffDelay(attempt, cfg))
      }
    } finally {
      clearTimeout(timer)
      state.active--
    }
  }
  throw lastError ?? new Error("请求失败")
}

/** 重置某注册商的限流/熔断状态（测试用） */
export function resetLimiter(slug: string): void {
  limiters.delete(slug)
}
