/**
 * @domainhub/renderer —— JS 动态渲染器公共入口
 *
 * 所有权：Platform Team
 * 文档：docs/adapter-sdk.md（Renderer 章节）
 *
 * 用法：
 *   const renderer = resolveRenderer()   // 按环境变量选择 provider
 *   const { html } = await renderer.render(url, { waitFor: ".price" })
 *
 * 环境变量：
 * - RENDERER_PROVIDER = browserless | scrapingbee | none（默认 none）
 * - Browserless：BROWSERLESS_URL, BROWSERLESS_TOKEN
 * - ScrapingBee：SCRAPINGBEE_API_KEY
 *
 * 切换 provider 只改 RENDERER_PROVIDER，不动任何适配器代码。
 */

import { BrowserlessProvider } from "./providers/browserless"
import { ScrapingBeeProvider } from "./providers/scrapingbee"
import { RendererNotConfiguredError, type RenderProvider } from "./types"

export * from "./types"
export { BrowserlessProvider } from "./providers/browserless"
export { ScrapingBeeProvider } from "./providers/scrapingbee"

let cached: RenderProvider | null = null
let cachedKey = ""

/**
 * 按环境变量解析渲染 provider。未配置时抛 RendererNotConfiguredError，
 * 供策略引擎捕获并降级到下一策略。
 */
export function resolveRenderer(): RenderProvider {
  const provider = (process.env.RENDERER_PROVIDER ?? "none").toLowerCase()

  // 简单缓存：provider 与其凭证不变时复用实例
  const key = [
    provider,
    process.env.BROWSERLESS_URL,
    process.env.BROWSERLESS_TOKEN ? "1" : "0",
    process.env.SCRAPINGBEE_API_KEY ? "1" : "0",
  ].join("|")
  if (cached && cachedKey === key) return cached

  let instance: RenderProvider
  switch (provider) {
    case "browserless": {
      const url = process.env.BROWSERLESS_URL
      const token = process.env.BROWSERLESS_TOKEN
      if (!url || !token) {
        throw new RendererNotConfiguredError(
          "RENDERER_PROVIDER=browserless 但缺少 BROWSERLESS_URL / BROWSERLESS_TOKEN",
        )
      }
      instance = new BrowserlessProvider(url, token)
      break
    }
    case "scrapingbee": {
      const apiKey = process.env.SCRAPINGBEE_API_KEY
      if (!apiKey) {
        throw new RendererNotConfiguredError(
          "RENDERER_PROVIDER=scrapingbee 但缺少 SCRAPINGBEE_API_KEY",
        )
      }
      instance = new ScrapingBeeProvider(apiKey)
      break
    }
    default:
      throw new RendererNotConfiguredError()
  }

  cached = instance
  cachedKey = key
  return instance
}

/** 渲染器是否已配置（用于发现阶段与后台展示） */
export function isRendererConfigured(): boolean {
  try {
    resolveRenderer()
    return true
  } catch {
    return false
  }
}
