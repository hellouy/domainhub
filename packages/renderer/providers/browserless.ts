/**
 * Browserless provider —— 通过 Browserless 云无头浏览器渲染。
 *
 * 端点约定：
 * - /content：返回渲染后 HTML（主用）
 * - /function：执行自定义 JS 并返回结果（用于 evaluate）
 *
 * 环境变量：
 * - BROWSERLESS_URL   例：https://chrome.browserless.io（或自托管地址）
 * - BROWSERLESS_TOKEN 访问令牌
 */

import type { RenderOptions, RenderProvider, RenderResult } from "../types"

export class BrowserlessProvider implements RenderProvider {
  readonly name = "browserless"
  private baseUrl: string
  private token: string

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "")
    this.token = token
  }

  async render(url: string, options: RenderOptions = {}): Promise<RenderResult> {
    const started = Date.now()
    const timeoutMs = options.timeoutMs ?? 30_000

    // evaluate 走 /function，否则走 /content
    if (options.evaluate) {
      const result = await this.runFunction(url, options, timeoutMs)
      return { ...result, elapsedMs: Date.now() - started }
    }

    const body: Record<string, unknown> = {
      url,
      gotoOptions: {
        waitUntil: options.waitUntil ?? "networkidle2",
        timeout: timeoutMs,
      },
    }
    if (typeof options.waitFor === "number") {
      body.waitForTimeout = options.waitFor
    } else if (typeof options.waitFor === "string") {
      body.waitForSelector = { selector: options.waitFor, timeout: timeoutMs }
    }
    if (options.blockAssets !== false) {
      body.rejectResourceTypes = ["image", "media", "font", "stylesheet"]
    }
    if (options.userAgent) body.userAgent = options.userAgent
    if (options.headers) body.setExtraHTTPHeaders = options.headers

    const res = await this.post("/content", body, timeoutMs)
    const html = await res.text()
    if (!res.ok) {
      throw new Error(`Browserless /content HTTP ${res.status}: ${html.slice(0, 200)}`)
    }
    return {
      html,
      status: res.status,
      provider: this.name,
      elapsedMs: Date.now() - started,
    }
  }

  private async runFunction(
    url: string,
    options: RenderOptions,
    timeoutMs: number,
  ): Promise<Omit<RenderResult, "elapsedMs">> {
    // Browserless /function 接收一段导出 async 函数的代码
    const code = `
      export default async function ({ page }) {
        await page.goto(${JSON.stringify(url)}, { waitUntil: ${JSON.stringify(options.waitUntil ?? "networkidle2")}, timeout: ${timeoutMs} });
        ${
          typeof options.waitFor === "number"
            ? `await new Promise(r => setTimeout(r, ${options.waitFor}));`
            : typeof options.waitFor === "string"
              ? `await page.waitForSelector(${JSON.stringify(options.waitFor)}, { timeout: ${timeoutMs} });`
              : ""
        }
        const evaluated = await page.evaluate(() => { ${options.evaluate} });
        const html = await page.content();
        return { data: { evaluated, html }, type: "application/json" };
      }
    `
    const res = await this.post("/function", { code }, timeoutMs)
    const text = await res.text()
    if (!res.ok) {
      throw new Error(`Browserless /function HTTP ${res.status}: ${text.slice(0, 200)}`)
    }
    let parsed: { evaluated?: unknown; html?: string }
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error(`Browserless /function 返回非 JSON：${text.slice(0, 200)}`)
    }
    return {
      html: parsed.html ?? "",
      status: res.status,
      evaluated: parsed.evaluated,
      provider: this.name,
    }
  }

  private post(path: string, body: unknown, timeoutMs: number): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs + 5_000)
    return fetch(`${this.baseUrl}${path}?token=${encodeURIComponent(this.token)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer))
  }
}
