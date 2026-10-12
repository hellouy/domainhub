/**
 * GET /api/cron/backfill —— 分批全量回填推进(Vercel Cron, 每日 03:30 UTC)
 * 鉴权: Authorization: Bearer ${CRON_SECRET}(Vercel Cron 自动携带)
 * 所有权: Platform Team, 文档: docs/api.md
 *
 * 单次 tick 对所有 status=running 的回填以 Drain 模式循环推进批次，
 * 直到全部采完或达到时间预算(maxDuration=300s，预算 240s)。
 * 兼容 Vercel Hobby 每日一次 Cron 的限制。
 */

import { NextResponse, type NextRequest } from "next/server"
import { hasValidCronAuthorization } from "@/lib/cron-auth"
import { drainRunningBackfills } from "@/services/crawl/backfill"

export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!hasValidCronAuthorization(request)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 })
  }

  const { batchesRan, outcomes } = await drainRunningBackfills()
  return NextResponse.json({ batchesRan, outcomes })
}
