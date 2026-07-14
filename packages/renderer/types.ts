/**
 * @domainhub/renderer —— JS 动态渲染器类型定义
 *
 * 所有权：Platform Team
 * 文档：docs/adapter-sdk.md（Renderer 章节）
 *
 * 供“必须执行 JS 才能拿到价格”的注册商使用。抽象为可插拔 provider，
 * 默认通过外部无头浏览器服务（Browserless/ScrapingBee）渲染，
 * 在 Vercel serverless（含 Hobby）上即可运行，无需自托管 chromium。
 *
 * 供应商无关：适配器只依赖 RenderProvider 接口，切换 provider 只改环境变量。
 */

/** 渲染请求选项（供应商无关，各 provider 各自映射到自身 API） */
export interface RenderOptions {
  /**
   * 等待条件：
   * - 数字：额外等待毫秒数
   * - 字符串：等待某 CSS 选择器出现
   */
  waitFor?: number | string
  /** 页面加载完成判定，默认 "networkidle" */
  waitUntil?: "load" | "domcontentloaded" | "networkidle"
  /** 自定义 User-Agent */
  userAgent?: string
  /** 是否屏蔽图片/字体/媒体等资源以加速，默认 true */
  blockAssets?: boolean
  /** 单次渲染超时毫秒，默认 30000 */
  timeoutMs?: number
  /** 额外请求头 */
  headers?: Record<string, string>
  /**
   * 在页面上下文执行并返回结果的 JS（可选）。
   * provider 支持时用于直接抽取数据，不支持时忽略。
   */
  evaluate?: string
  /**
   * 捕获页面加载期间的 XHR/fetch JSON 响应（默认 false）。
   * 开启后 provider 会收集 content-type 为 JSON 的响应体，供发现引擎
   * 直接解析真实数据源，避免依赖 DOM 或 LLM。仅本地 Playwright 支持。
   */
  captureJson?: boolean
  /** 只捕获 URL 匹配这些子串的响应（省略时捕获全部 JSON 响应） */
  captureUrlIncludes?: string[]
}

/** 捕获到的一个 XHR/fetch JSON 响应 */
export interface CapturedResponse {
  url: string
  body: string
}

/** 渲染结果 */
export interface RenderResult {
  /** 渲染后的完整 HTML */
  html: string
  /** HTTP 状态码（provider 能提供时） */
  status: number
  /** evaluate 的返回值（provider 支持且提供了 evaluate 时） */
  evaluated?: unknown
  /** 实际使用的 provider 名称 */
  provider: string
  /** 渲染耗时毫秒 */
  elapsedMs: number
  /** captureJson 开启时捕获到的 XHR/fetch JSON 响应 */
  capturedJson?: CapturedResponse[]
}

/** 可插拔渲染 provider 接口 */
export interface RenderProvider {
  /** provider 名称，用于日志与指标 */
  readonly name: string
  /** 渲染目标 URL，返回渲染后 HTML */
  render(url: string, options?: RenderOptions): Promise<RenderResult>
}

/** 渲染器未配置时抛出，供策略引擎识别并降级 */
export class RendererNotConfiguredError extends Error {
  constructor(message = "未配置 JS 渲染器 provider（缺少 RENDERER_PROVIDER 或对应凭证）") {
    super(message)
    this.name = "RendererNotConfiguredError"
  }
}
