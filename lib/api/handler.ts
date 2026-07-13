import "server-only"

import { NextResponse } from "next/server"
import { metricsService } from "@/services/metrics"
import { clientIp, publicRateLimiter } from "./rate-limit"

/**
 * 公开 API 统一处理层（Sprint 4 Part 2 + 9）
 *
 * 所有 /api/v1/* 路由通过 createApiHandler 包裹，自动获得：
 * - Request ID（X-Request-Id，响应头返回，便于排障）
 * - 限流（120 req/min/IP，超限返回 429 + Retry-After）
 * - 响应耗时指标（api.response_time，落 metrics 表）
 * - 统一错误处理（500 携带 Error ID，不泄漏内部细节）
 * - 安全响应头（nosniff / no frame / referrer policy）
 */

type RouteContext = { params: Promise<Record<string, string>> }
type ApiHandler = (request: Request, ctx: RouteContext) => Promise<NextResponse>

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function applySecureHeaders(res: NextResponse, requestId: string): NextResponse {
  res.headers.set("X-Request-Id", requestId)
  res.headers.set("X-Content-Type-Options", "nosniff")
  res.headers.set("X-Frame-Options", "DENY")
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  return res
}

export function createApiHandler(routeName: string, handler: ApiHandler): ApiHandler {
  return async (request, ctx) => {
    const requestId = request.headers.get("x-request-id") ?? makeId("req")
    const start = Date.now()

    // 限流
    const limit = publicRateLimiter.check(clientIp(request))
    if (!limit.allowed) {
      const res = NextResponse.json(
        { error: "请求过于频繁，请稍后再试", requestId },
        { status: 429 },
      )
      res.headers.set("Retry-After", Math.ceil((limit.resetAt - Date.now()) / 1000).toString())
      return applySecureHeaders(res, requestId)
    }

    try {
      const res = await handler(request, ctx)
      res.headers.set("X-RateLimit-Remaining", limit.remaining.toString())
      return applySecureHeaders(res, requestId)
    } catch (err) {
      const errorId = makeId("err")
      console.log(`[v0] API ${routeName} 错误 ${errorId}:`, err instanceof Error ? err.message : err)
      const res = NextResponse.json(
        { error: "服务器内部错误", errorId, requestId },
        { status: 500 },
      )
      return applySecureHeaders(res, requestId)
    } finally {
      void metricsService.record("api.response_time", Date.now() - start, "ms", routeName)
    }
  }
}
