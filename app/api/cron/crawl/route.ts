/**
 * GET /api/cron/crawl —— 每日定时采集(Vercel Cron)
 * 鉴权: Authorization: Bearer ${CRON_SECRET}(Vercel Cron 自动携带)
 * 所有权: Platform Team, 文档: docs/api.md
 */

import { NextResponse, type NextRequest } from "next/server"
import { hasValidCronAuthorization } from "@/lib/cron-auth"
import { runCrawlJob } from "@/lib/crawler/runner"
import { drainQueue, scheduleAll } from "@/packages/scheduler"

export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!hasValidCronAuthorization(request)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 })
  }

  const enqueued = await scheduleAll("cron")
  const result = await drainQueue(
    async (registrarId) => {
      const res = await runCrawlJob(registrarId)
      return { ok: res.ok, error: res.error }
    },
    { budgetMs: 270_000 },
  )

  return NextResponse.json({ enqueued, ...result })
}
