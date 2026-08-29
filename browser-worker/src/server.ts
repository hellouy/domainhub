/**
 * Browser Worker —— 远程浏览器渲染 / 内容提取服务
 * ------------------------------------------------------------
 * 所有权：Platform Team
 * 文档：docs/adapter-sdk.md（Browser Strategy 章节）
 *
 * 背景：Vercel serverless 无法运行无头浏览器。JS 渲染 / 客户端动态
 * 加载价格的站点（SPA、动态表格、部分反爬站点）用普通 fetch 拿不到内容。
 *
 * 本服务独立部署在任何可运行 Playwright 的 Node 主机上，通过 HTTP 对外提供
 * “渲染页面 + 注入提取脚本”能力：
 *
 *   POST /render   { url, extract, waitFor, ... } -> { ok, extracted|html, ... }
 *   GET  /health   { ok, chromiumAvailable, ... }
 *
 * 主站 Adapter SDK 的 playwright 策略通过环境变量 BROWSER_SERVICE_URL 调用本服务，
 * 渲染完成后拿着提取 JSON 继续原有 parse -> validate -> save 生命周期。
 *
 * 注意：必须用 `node --experimental-strip-types` 启动（见 package.json start 脚本）。
 * 用 tsx 启动时页面端 page.evaluate 会抛 “__name is not defined” 使全部渲染失败。
 * 启动：npx playwright install chromium && npm start
 *
 * 默认提取脚本复用 /workspace/scripts/browser-capture/extract.js
 * （表格优先、div 网格兜底），输出规范化为 RawPrice 形状。
 */

import express, { type Request, type Response } from "express"
import { readFileSync } from "node:fs"
import { chromium, type Browser } from "playwright"

const PORT = Number(process.env.PORT ?? 8840)
/** 同时最多并发渲染的任务数（内存受限） */
const CONCURRENCY = Number(process.env.BROWSER_WORKER_CONCURRENCY ?? 2)
/** 单个任务的最长渲染时间（毫秒），超时后服务端强制结束 */
const TASK_TIMEOUT_MS = Number(process.env.BROWSER_WORKER_TIMEOUT_MS ?? 90_000)
/** 页面导航 / 等待选择器的超时（毫秒） */
const NAV_TIMEOUT_MS = 60_000
/** 等待 networkidle 的宽松超时（毫秒） */
const NETWORK_IDLE_TIMEOUT_MS = 15_000
const VERSION = "1.0.0"

// 默认提取脚本（IIFE，evaluate 后返回价格 JSON 字符串）
const EXTRACT_SCRIPT = readFileSync(
  new URL("../../scripts/browser-capture/extract.js", import.meta.url),
  "utf8",
)

// 真实桌面 Chrome UA，规避简易 UA 反爬
const REAL_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

interface RenderRequest {
  url: string
  /** 返回形态：extract-json（默认）| html */
  extract?: "extract-json" | "html"
  /** 等待页面出现该 CSS 选择器后再提取 */
  waitFor?: string | null
  /** 等待选择器的超时毫秒（默认 30_000） */
  waitForTimeoutMs?: number
  /** 提取前滚动到底部触发动态加载（默认 true） */
  scrollToBottom?: boolean
  /** 模拟地区 locale（影响 GeoIP 分区定价） */
  locale?: string | null
  /** 初始导航附加请求头（部分站点校验 Referer 等） */
  headers?: Record<string, string>
  /** 自定义提取脚本（JS 源码，默认用内置 extract.js） */
  script?: string | null
}

interface RenderResponse {
  ok: boolean
  url?: string
  finalUrl?: string
  title?: string
  durationMs: number
  /** extract-json 形态的规范化提取结果 */
  extracted?: Array<Record<string, unknown>>
  /** html 形态的完整渲染后页面 */
  html?: string
  error?: string
}

const app = express()
app.use(express.json({ limit: "1mb" }))

// ---- 并发闸门：超过配额的任务排队等待，防止内存超载 ----
let active = 0
const waitQueue: Array<() => void> = []
async function acquireSlot(): Promise<() => void> {
  if (active < CONCURRENCY) {
    active++
    let released = false
    return () => {
      if (released) return
      released = true
      active--
      waitQueue.shift()?.()
    }
  }
  await new Promise<void>((resolve) => waitQueue.push(resolve))
  return acquireSlot()
}

let browserPromise: Promise<Browser> | null = null
function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    })
  }
  return browserPromise
}

/** 渲染单个页面并按要求提取。所有导航/等待都带超时，失败抛错。 */
async function render(input: RenderRequest): Promise<RenderResponse> {
  const started = Date.now()
  const browser = await getBrowser()
  const context = await browser.newContext({
    userAgent: REAL_UA,
    locale: input.locale ?? "en-US",
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: input.headers ?? {},
  })
  const page = await context.newPage()
  try {
    await page.setDefaultTimeout(NAV_TIMEOUT_MS)

    await page.goto(input.url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS })
    // 等 SPA 完成异步数据加载（networkidle 失败不阻断，仅放宽）
    await page
      .waitForLoadState("networkidle", { timeout: NETWORK_IDLE_TIMEOUT_MS })
      .catch(() => {})

    // 可选：等待业务选择器出现（价格表已挂载）
    if (input.waitFor) {
      await page
        .locator(input.waitFor)
        .first()
        .waitFor({ state: "visible", timeout: input.waitForTimeoutMs ?? 30_000 })
    }

    // 可选：滚动到底触发动态加载
    if (input.scrollToBottom !== false) {
      await page.evaluate(async () => {
        const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
        for (let i = 0; i < 10; i++) {
          window.scrollTo(0, document.body.scrollHeight)
          await delay(300)
          if (window.scrollY + window.innerHeight >= document.body.scrollHeight - 10) break
        }
      })
    }

    const finalUrl = page.url()
    const title = await page.title().catch(() => "")

    if (input.extract === "html") {
      return {
        ok: true,
        url: input.url,
        finalUrl,
        title,
        durationMs: Date.now() - started,
        html: await page.content(),
      }
    }

    // extract-json：执行提取脚本，规范化字段
    const script = input.script && input.script.trim().length > 0 ? input.script : EXTRACT_SCRIPT
    const raw = (await page.evaluate(script)) as string
    let list: Array<{
      tld?: string
      register?: number | null
      renew?: number | null
      transfer?: number | null
    }> = []
    try {
      list = JSON.parse(raw) as typeof list
    } catch {
      throw new Error("页面上执行提取脚本后返回的不是有效 JSON")
    }

    const extracted = list
      .filter((r) => typeof r?.tld === "string" && r.tld.trim().length > 0)
      .map((r) => ({
        tld: r.tld!.toLowerCase().replace(/^\./, ""),
        registerPrice: r.register ?? null,
        renewPrice: r.renew ?? null,
        transferPrice: r.transfer ?? null,
        sourceUrl: finalUrl,
      }))

    if (extracted.length === 0) {
      throw new Error("提取脚本未找到任何价格行（页面结构可能已变化）")
    }

    return {
      ok: true,
      url: input.url,
      finalUrl,
      title,
      durationMs: Date.now() - started,
      extracted,
    }
  } finally {
    await page.close().catch(() => {})
    await context.close().catch(() => {})
  }
}

app.post("/render", async (req: Request, res: Response) => {
  const input = (req.body ?? {}) as RenderRequest
  if (!input.url || !/^https?:\/\//i.test(input.url)) {
    res.status(400).json({ ok: false, error: "url 缺失或不是 http(s) 地址", durationMs: 0 })
    return
  }
  const release = await acquireSlot()
  try {
    const result = await Promise.race([
      render(input),
      new Promise<RenderResponse>((resolve) =>
        setTimeout(
          () => resolve({ ok: false, error: `浏览器任务超时（>${TASK_TIMEOUT_MS}ms）`, durationMs: TASK_TIMEOUT_MS }),
          TASK_TIMEOUT_MS,
        ),
      ),
    ])
    res.status(result.ok ? 200 : 502).json(result)
  } catch (err) {
    res.status(502).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: 0,
    })
  } finally {
    release()
  }
})

app.get("/health", async (_req: Request, res: Response) => {
  let chromiumAvailable = false
  try {
    const browser = await getBrowser()
    chromiumAvailable = browser.isConnected()
  } catch {
    chromiumAvailable = false
  }
  res.json({
    ok: true,
    service: "browser-worker",
    version: VERSION,
    chromiumAvailable,
    activeTasks: active,
    concurrency: CONCURRENCY,
  })
})

app.listen(PORT, () => {
  console.log(`[browser-worker] listening on http://localhost:${PORT} (version ${VERSION})`)
})