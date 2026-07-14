/**
 * GET /api/cron/backfill —— 分批全量回填推进(Vercel Cron, 每 5 分钟)
 * 鉴权: Authorization: Bearer ${CRON_SECRET}(Vercel Cron 自动携带)
 * 所有权: Platform Team, 文档: docs/api.md
 *
 * 每次 tick 对所有 status=running 的回填各推进“一批”(到达间隔才跑)。
 * 采完自动置 completed，后续 tick 空转。
 */

import { NextResponse, type NextRequest } from "next/server"
import { listRunningBackfills, runNextBatch } from "@/services/crawl/backfill"

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "未授权" }, { status: 401 })
  }

  const running = await listRunningBackfills()
  const outcomes = []
  for (const registrarId of running) {
    try {
      outcomes.push(await runNextBatch(registrarId))
    } catch (err) {
      outcomes.push({
        ran: false,
        registrarId,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({ running: running.length, outcomes })
}
