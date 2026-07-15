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

      // goto 采用容错策略：默认 "domcontentloaded"(快且可靠)，而非 "networkidle"。
      // 很多站有广告/分析/长轮询/websocket，永远达不到 networkidle 会导致 30s 超时。
      // 即便 goto 超时，页面通常已加载且 XHR 已被捕获——不能因超时丢弃全部结果。
      let gotoResponse: Awaited<ReturnType<typeof page.goto>> = null
      try {
        gotoResponse = await page.goto(url, {
          waitUntil: options.waitUntil ?? "domcontentloaded",
          timeout: timeoutMs,
        })
      } catch (err) {
        // 超时/导航中断：保留已加载内容与已捕获 XHR，继续后续解析
        console.log(`[v0] renderer goto 未完全加载(继续解析已有内容): ${(err as Error).message}`)
      }

      // 等待条件（同样容错，不因等待失败而丢弃已捕获数据）
      try {
        if (typeof options.waitFor === "number") {
          await page.waitForTimeout(options.waitFor)
        } else if (typeof options.waitFor === "string") {
          // 选择器等待上限收敛到 8s，避免长时间空等
          await page.waitForSelector(options.waitFor, { timeout: Math.min(timeoutMs, 8_000) })
        } else {
          // 未指定等待条件时，给 XHR 一个短暂的落地窗口(捕获动态价格 API)
          await page.waitForTimeout(1_500)
        }
      } catch {
        // 等待条件未命中：仍尝试解析当前页面 + 已捕获的 XHR
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
