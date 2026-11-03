/**
 * Browser Service Fleet —— 带健康检查与失败转移的 browser-worker 舰队客户端
 * ----------------------------------------------------------------------------
 * 所有权: Platform Team
 *
 * BROWSER_SERVICE_URL 支持逗号分隔的多地址（舰队）：
 *   BROWSER_SERVICE_URL=http://host1:8840,http://host2:8841,http://host3:8842
 *
 * 选择逻辑：
 *   1. GET /health 探活（4s 超时），结果缓存 30s（健康）/ 60s（不健康）
 *   2. 轮询（round-robin）选取 worker，跳过近期探活失败的实例
 *   3. POST /render 渲染；传输错误、超时、HTTP 402/502/503/504 标记该 worker
 *      死亡并切换下一个实例
 *   4. HTTP 400/401 属请求或鉴权问题，换 worker 无意义，直接抛出
 *
 * 全部实例不可达时抛出 BrowserServiceError，由策略引擎降级到下一策略。
 * 单地址配置时行为与直连等价（向后兼容）。
 */

export interface BrowserRenderPayload {
  url: string
  extract?: "html" | "extract-json" | "xhr-json" | "api-fetch"
  waitFor?: string | null
  waitForTimeoutMs?: number
  scrollToBottom?: boolean
  locale?: string | null
  headers?: Record<string, string>
  script?: string | null
  captureXhrFilter?: string[]
  apiFetch?: {
    url: string
    method?: "GET" | "POST" | "PUT" | "PATCH"
    headers?: Record<string, string>
    body?: Record<string, unknown>
  } | null
}

export interface BrowserRenderResponse {
  ok: boolean
  url?: string
  finalUrl?: string
  title?: string
  durationMs?: number
  extracted?: unknown[]
  html?: string
  xhrResponses?: unknown[]
  api?: { status: number; body: string } | null
  error?: string
}

export class BrowserServiceError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = "BrowserServiceError"
  }
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>

const HEALTH_TIMEOUT_MS = 4_000
const HEALTH_POSITIVE_TTL_MS = 30_000
const HEALTH_NEGATIVE_TTL_MS = 60_000
const DEFAULT_RENDER_TIMEOUT_MS = 95_000

interface WorkerHealth {
  lastOkAt: number
  lastFailAt: number
}

let cachedUrls: string[] | null = null

/** 解析 BROWSER_SERVICE_URL（逗号分隔舰队列表），进程内缓存 */
export function listBrowserServiceUrls(): string[] {
  if (cachedUrls) return cachedUrls
  const raw = process.env.BROWSER_SERVICE_URL ?? ""
  cachedUrls = raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
  return cachedUrls
}

const healthState = new Map<string, WorkerHealth>()
let roundRobinCursor = 0

async function probeHealth(base: string, fetchFn: FetchFn): Promise<boolean> {
  try {
    const res = await fetchFn(`${base}/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) })
    if (!res.ok) return false
    const data = (await res.json()) as { ok?: boolean }
    return data.ok === true
  } catch {
    return false
  }
}

function rememberResult(base: string, healthy: boolean): void {
  const st = healthState.get(base) ?? { lastOkAt: 0, lastFailAt: 0 }
  if (healthy) st.lastOkAt = Date.now()
  else st.lastFailAt = Date.now()
  healthState.set(base, st)
}

function isFresh(ts: number, ttl: number): boolean {
  return ts > 0 && Date.now() - ts < ttl
}

/** 健康门控选 worker：轮询起点随每次成功推进，跳过近期失败的实例 */
async function pickWorker(fetchFn: FetchFn): Promise<string | null> {
  const urls = listBrowserServiceUrls()
  if (urls.length === 0) return null
  for (let i = 0; i < urls.length; i++) {
    const idx = (roundRobinCursor + i) % urls.length
    const base = urls[idx]
    const st = healthState.get(base)
    if (st && isFresh(st.lastFailAt, HEALTH_NEGATIVE_TTL_MS)) continue
    if (st && isFresh(st.lastOkAt, HEALTH_POSITIVE_TTL_MS)) {
      roundRobinCursor = (idx + 1) % urls.length
      return base
    }
    if (await probeHealth(base, fetchFn)) {
      rememberResult(base, true)
      roundRobinCursor = (idx + 1) % urls.length
      return base
    }
    rememberResult(base, false)
  }
  return null
}

export interface BrowserRenderOptions {
  /**
   * 自定义 fetch（测试/诊断注入用）。缺省用全局 fetch：
   * browser-worker 是内部基建调用，不经适配器站点限流/重试/熔断链
   * （rateLimitedFetch 会覆盖调用方 signal 并把探测拖到 60s）。
   */
  fetchFn?: FetchFn
  /** 单次渲染超时（默认 95s，须小于调用方函数 maxDuration 预算） */
  timeoutMs?: number
}

/**
 * 向 browser-worker 舰队提交渲染任务，自动健康检查 + 失败转移。
 * 返回 worker 原始响应 JSON（{ ok, extracted | html | xhrResponses | api, error }）。
 */
export async function browserRender(
  payload: BrowserRenderPayload,
  opts: BrowserRenderOptions = {},
): Promise<BrowserRenderResponse> {
  const urls = listBrowserServiceUrls()
  if (urls.length === 0) {
    throw new BrowserServiceError("未配置 BROWSER_SERVICE_URL（browser-worker 地址，支持逗号分隔多地址舰队）")
  }
  const token = process.env.BROWSER_SERVICE_TOKEN ?? ""
  const fetchFn: FetchFn = opts.fetchFn ?? fetch
  const timeoutMs = opts.timeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS
  let lastError: Error = new Error("browser-worker 渲染失败")

  for (let attempt = 0; attempt < urls.length; attempt++) {
    const base = await pickWorker(fetchFn)
    if (!base) {
      if (attempt === 0) {
        throw new BrowserServiceError(`全部 ${urls.length} 个 browser-worker 健康检查失败，无法渲染 ${payload.url}`)
      }
      throw new BrowserServiceError(`全部 ${urls.length} 个 browser-worker 渲染失败（已无健康实例），最后错误：${lastError.message}`)
    }
    try {
      const res = await fetchFn(`${base}/render`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (res.status === 400 || res.status === 401) {
        const text = await safeReadText(res)
        throw new BrowserServiceError(`browser-worker 返回 HTTP ${res.status}：${text.slice(0, 200)}`, res.status)
      }
      if (!res.ok) {
        rememberResult(base, false)
        lastError = new Error(`browser-worker ${base} 返回 HTTP ${res.status}`)
        continue
      }
      const data = (await res.json()) as BrowserRenderResponse
      rememberResult(base, true)
      return data
    } catch (e) {
      if (e instanceof BrowserServiceError) throw e
      rememberResult(base, false)
      lastError = e instanceof Error ? e : new Error(String(e))
    }
  }
  throw new BrowserServiceError(`全部 ${urls.length} 个 browser-worker 渲染失败：${lastError.message}`)
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ""
  }
}
