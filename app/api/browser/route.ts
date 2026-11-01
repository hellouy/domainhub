/**
 * Browser Worker Proxy —— POST /api/browser
 * ===========================================
 * Vercel serverless 无法运行 Playwright。本 route 把 SDK playwright 策略的
 * `/render` 请求转发到独立部署的 browser-worker（真实 Chromium 渲染），
 * 透传 Bearer 令牌与响应体，SDK 侧契约不变。
 *
 * 环境变量：
 *   BROWSER_WORKER_URL        远程 browser-worker 根地址（如 http://host:8840）
 *   BROWSER_WORKER_TOKEN      与 worker 的 BROWSER_WORKER_TOKEN 一致（>=32 字符）
 *
 * 主站配置：
 *   BROWSER_SERVICE_URL=https://<本域名>/api/browser
 *   BROWSER_SERVICE_TOKEN=<同一 token>
 *
 * 说明：SDK 会请求 `${BROWSER_SERVICE_URL}/render`，当 BROWSER_SERVICE_URL 指向
 * `https://<域名>/api/browser` 时实际命中 `/api/browser/render`，由同目录
 * `render/route.ts` 重导出本文件的 POST/GET 处理。
 */

import { type NextRequest, NextResponse } from "next/server"

const WORKER_URL = (process.env.BROWSER_WORKER_URL ?? "").replace(/\/+$/, "")
const WORKER_TOKEN = process.env.BROWSER_WORKER_TOKEN ?? ""

export const maxDuration = 120

async function proxyRender(request: NextRequest): Promise<NextResponse> {
  if (!WORKER_URL || !WORKER_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "BROWSER_WORKER_URL / BROWSER_WORKER_TOKEN 未配置", durationMs: 0 },
      { status: 503 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "请求体必须是 JSON 对象", durationMs: 0 }, { status: 400 })
  }

  if (!body || typeof body !== "object" || Array.isArray(body) || typeof (body as { url?: unknown }).url !== "string") {
    return NextResponse.json({ ok: false, error: "url 缺失", durationMs: 0 }, { status: 400 })
  }

  let upstream: Response
  try {
    upstream = await fetch(`${WORKER_URL}/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${WORKER_TOKEN}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(115_000),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch failed"
    return NextResponse.json({ ok: false, error: `browser-worker unreachable: ${message}`, durationMs: 0 }, { status: 502 })
  }

  const text = await upstream.text()
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  })
}

export async function POST(request: NextRequest) {
  return proxyRender(request)
}

export async function GET() {
  return NextResponse.json(
    { ok: !!WORKER_URL, workerConfigured: !!WORKER_URL, durationMs: 0 },
    { status: WORKER_URL ? 200 : 503 },
  )
}
