/**
 * ScrapingBee provider —— 通过 ScrapingBee API 渲染（自带代理池 + 反爬）。
 *
 * 环境变量：
 * - SCRAPINGBEE_API_KEY
 *
 * 文档：https://www.scrapingbee.com/documentation/
 */

import type { RenderOptions, RenderProvider, RenderResult } from "../types"

export class ScrapingBeeProvider implements RenderProvider {
  readonly name = "scrapingbee"
  private apiKey: string
  private endpoint = "https://app.scrapingbee.com/api/v1/"

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async render(url: string, options: RenderOptions = {}): Promise<RenderResult> {
    const started = Date.now()
    const timeoutMs = options.timeoutMs ?? 30_000

    const params = new URLSearchParams({
      api_key: this.apiKey,
      url,
      render_js: "true",
      // ScrapingBee 屏蔽资源用 block_resources，默认 true 即屏蔽图片等
      block_resources: options.blockAssets === false ? "false" : "true",
    })
    if (typeof options.waitFor === "number") {
      params.set("wait", String(options.waitFor))
    } else if (typeof options.waitFor === "string") {
      params.set("wait_for", options.waitFor)
    }
    if (options.evaluate) {
      // ScrapingBee 用 js_scenario 执行 JS；此处用 evaluate 抓取，返回在页面中
      params.set("js_scenario", JSON.stringify({ instructions: [{ evaluate: options.evaluate }] }))
    }
    if (options.headers) {
      params.set("forward_headers", "true")
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs + 5_000)
    let res: Response
    try {
      res = await fetch(`${this.endpoint}?${params.toString()}`, {
        method: "GET",
        headers: options.headers
          ? Object.fromEntries(
              Object.entries(options.headers).map(([k, v]) => [`Spb-${k}`, v]),
            )
          : undefined,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }

    const html = await res.text()
    if (!res.ok) {
      throw new Error(`ScrapingBee HTTP ${res.status}: ${html.slice(0, 200)}`)
    }
    return {
      html,
      status: res.status,
      provider: this.name,
      elapsedMs: Date.now() - started,
    }
  }
}
