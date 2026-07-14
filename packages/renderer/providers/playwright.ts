/**
 * Playwright provider —— 本地无头浏览器渲染（默认 provider）。
 *
 * 使用本地 chromium（playwright 自带），无需任何 API key 或云服务，
 * 开箱即用。适合本地开发、脚本采集、以及能运行完整 chromium 的环境。
 *
 * 云端 serverless（如 Vercel Hobby）若无法运行本地 chromium，
 * 可配置 RENDERER_PROVIDER=browserless|scrapingbee 切换到云 provider，
 * 适配器代码完全不用改。
 *
 * 环境变量（均可选）：
 * - PLAYWRIGHT_HEADLESS = "false" 时以有头模式启动（调试用），默认无头
 * - PLAYWRIGHT_EXECUTABLE_PATH  自定义 chromium 可执行文件路径
 */

import type { Browser, BrowserContext } from "playwright"
import type { CapturedResponse, RenderOptions, RenderProvider, RenderResult } from "../types"

export class PlaywrightProvider implements RenderProvider {
  readonly name = "playwright"

  // 复用单个浏览器实例，避免每次渲染都冷启动
  private browserPromise: Promise<Browser> | null = null

  private async getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = (async () => {
        const { chromium } = await import("playwright")
        return chromium.launch({
          headless: process.env.PLAYWRIGHT_HEADLESS !== "false",
          executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
          ],
        })
      })().catch((err) => {
        // 启动失败时清空缓存，下次可重试
        this.browserPromise = null
        throw err
      })
    }
    return this.browserPromise
  }

  async render(url: string, options: RenderOptions = {}): Promise<RenderResult> {
    const started = Date.now()
    const timeoutMs = options.timeoutMs ?? 30_000
    const browser = await this.getBrowser()

    let context: BrowserContext | null = null
    try {
      context = await browser.newContext({
        userAgent:
          options.userAgent ??
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        extraHTTPHeaders: options.headers,
        locale: "en-US",
      })
      const page = await context.newPage()

      // 捕获 XHR/fetch JSON 响应(供发现引擎解析真实数据源)
      const captured: CapturedResponse[] = []
      if (options.captureJson) {
        const includes = options.captureUrlIncludes
        page.on("response", (response) => {
          void (async () => {
            try {
              const req = response.request()
              const rt = req.resourceType()
              if (rt !== "xhr" && rt !== "fetch") return
              const url = response.url()
              if (includes && includes.length > 0 && !includes.some((s) => url.includes(s))) return
              const ct = response.headers()["content-type"] ?? ""
              if (!/json/i.test(ct)) return
              const body = await response.text()
              if (body && body.length < 5_000_000) captured.push({ url, body })
            } catch {
              // 忽略无法读取的响应(重定向/被中断等)
            }
          })()
        })
      }

      // 屏蔽图片/字体/媒体/样式表以加速（默认开启）
      if (options.blockAssets !== false) {
        await page.route("**/*", (route) => {
          const type = route.request().resourceType()
          if (type === "image" || type === "media" || type === "font" || type === "stylesheet") {
            return route.abort()
          }
          return route.continue()
        })
      }

      const gotoResponse = await page.goto(url, {
        waitUntil: options.waitUntil ?? "networkidle",
        timeout: timeoutMs,
      })

      // 等待条件
      if (typeof options.waitFor === "number") {
        await page.waitForTimeout(options.waitFor)
      } else if (typeof options.waitFor === "string") {
        await page.waitForSelector(options.waitFor, { timeout: timeoutMs })
      }

      let evaluated: unknown
      if (options.evaluate) {
        // 在页面上下文执行自定义 JS 并取回结果
        evaluated = await page.evaluate(`(() => { ${options.evaluate} })()`)
      }

      const html = await page.content()
      const status = gotoResponse?.status() ?? 0

      return {
        html,
        status,
        evaluated,
        provider: this.name,
        elapsedMs: Date.now() - started,
        capturedJson: options.captureJson ? captured : undefined,
      }
    } finally {
      // 关闭 context（释放页面），但保留 browser 实例复用
      if (context) await context.close().catch(() => {})
    }
  }

  /** 关闭浏览器实例（进程退出前调用，释放资源） */
  async close(): Promise<void> {
    if (this.browserPromise) {
      const browser = await this.browserPromise.catch(() => null)
      this.browserPromise = null
      if (browser) await browser.close().catch(() => {})
    }
  }
}
