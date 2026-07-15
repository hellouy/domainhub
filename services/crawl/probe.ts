/**
 * URL 探测服务 —— 后台"添加注册商网址即自动尝试抓取"的引擎
 * ------------------------------------------------------------
 * 所有权: Platform Team
 *
 * 职责: 给定一个价格页 URL, 不依赖任何已注册适配器、不写数据库,
 * 自动按多策略链尝试发现价格数据, 返回预览结果供管理员判断该站是否可接入。
 *
 * 策略链(与 createAutoAdapter 一致, 真实数据源优先):
 *   1. 静态 fetch → 内嵌 JSON 发现(__NEXT_DATA__/ld+json/window 赋值等)
 *   2. 静态 fetch → Cheerio 结构化 HTML
 *   3. 渲染(本地 Playwright)+ 捕获 XHR/fetch JSON → 发现引擎
 * 任一策略拿到价格即返回, 记录命中策略与来源。
 */

import { discoverPrices, type DiscoveredPrice } from "@/packages/discovery"
import { rateLimitedFetch } from "@/packages/adapter-sdk"
import { resolveRenderer } from "@/packages/renderer"

export interface ProbeResult {
  ok: boolean
  /** 命中的策略: static-json | static-html | rendered-xhr | rendered-html | none */
  strategy: string
  /** 发现的价格条数 */
  count: number
  /** 推断的货币 */
  currency: string
  /** 前若干条样例(供管理员肉眼核对) */
  samples: DiscoveredPrice[]
  /** 渲染时捕获到的 XHR JSON 端点(便于确认真实数据源) */
  capturedEndpoints?: string[]
  message: string
  error?: string
}

const PROBE_RATE_LIMIT = { concurrency: 1, rpm: 30, retries: 1, timeoutMs: 45_000 }

/** 探测一个价格页 URL, 返回可抓取性预览(不写库) */
export async function probeUrl(url: string): Promise<ProbeResult> {
  let normalized: string
  try {
    normalized = new URL(url).toString()
  } catch {
    return { ok: false, strategy: "none", count: 0, currency: "UNKNOWN", samples: [], message: "无效的 URL", error: "invalid-url" }
  }

  const slug = "probe"

  // 静态结果达到此数量即认为足够可信, 直接返回(省去渲染开销)
  const STATIC_CONFIDENT = 30

  let best: ProbeResult | null = null
  let renderError: string | undefined

  // ---- 策略 1+2: 静态 fetch → JSON 发现 / Cheerio ----
  try {
    const res = await rateLimitedFetch(slug, normalized, undefined, PROBE_RATE_LIMIT, () => {})
    if (res.ok) {
      const staticHtml = await res.text()
      const staticResult = discoverPrices({ html: staticHtml, currency: "UNKNOWN" })
      if (staticResult.prices.length > 0) {
        const strategy = staticResult.method === "embedded-json" ? "static-json" : "static-html"
        best = buildResult(strategy, staticResult)
        // 静态已拿到足量数据, 直接返回, 不再耗时渲染
        if (best.count >= STATIC_CONFIDENT) return best
      }
    }
  } catch {
    // 静态失败, 继续走渲染
  }

  // ---- 策略 3: 渲染 + 捕获 XHR → 发现引擎 ----
  // 无论静态是否命中都尝试渲染: 很多站静态页只含少量诱饵数据,
  // 真实全量在 JS 渲染后的 XHR/API 里。最终取价格更多的结果。
  try {
    const rendered = await resolveRenderer().render(normalized, {
      waitFor: 4000,
      captureJson: true,
    })
    const captured = (rendered.capturedJson ?? []).map((c) => ({ url: c.url, body: c.body }))
    const renderedResult = discoverPrices({
      html: rendered.html,
      capturedJson: captured,
      currency: "UNKNOWN",
    })
    if (renderedResult.prices.length > 0) {
      const strategy = renderedResult.method === "xhr-json" ? "rendered-xhr" : "rendered-html"
      const endpoints = captured.map((c) => c.url).slice(0, 10)
      const renderedProbe = { ...buildResult(strategy, renderedResult), capturedEndpoints: endpoints }
      // 择优: 取价格条数更多者
      if (!best || renderedProbe.count > best.count) best = renderedProbe
    }
  } catch (e) {
    renderError = e instanceof Error ? e.message : String(e)
  }

  if (best) return best

  return {
    ok: false, strategy: "none", count: 0, currency: "UNKNOWN", samples: [],
    message: renderError
      ? "所有策略均未发现价格(含渲染)。该站可能需要登录、API 凭证或特殊反爬处理。"
      : "未在该页面发现价格数据。请确认这是价格/价目表页面 URL。",
    error: renderError,
  }
}

function buildResult(
  strategy: string,
  result: { prices: DiscoveredPrice[] },
): ProbeResult {
  // 币种在每条价格上，取首个非空者作为整体推断
  const currency = result.prices.find((p) => p.currency && p.currency !== "UNKNOWN")?.currency ?? "UNKNOWN"
  return {
    ok: true,
    strategy,
    count: result.prices.length,
    currency,
    samples: result.prices.slice(0, 12),
    message: `通过 ${strategy} 策略发现 ${result.prices.length} 个后缀价格`,
  }
}
