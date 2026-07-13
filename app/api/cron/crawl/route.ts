import { NextResponse } from "next/server"
import { crawlerRunner } from "@/services/crawler"
import { storageService } from "@/services/storage"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * 每日定时采集入口。
 * 由 Vercel Cron（vercel.json 中配置 0 * * * * 每小时触发）或外部调度器调用；
 * 内部检查 scheduler_settings：仅当已启用、到达设定时刻（UTC）且今天未运行时才执行。
 * 支持 CRON_SECRET（可选）：设置后需携带 Authorization: Bearer <CRON_SECRET>。
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    }
  }

  const settings = await storageService.getSchedulerSettings()
  if (!settings?.enabled) {
    return NextResponse.json({ ok: true, ran: false, reason: "调度未启用" })
  }

  const now = new Date()
  if (now.getUTCHours() !== settings.runHourUtc) {
    return NextResponse.json({ ok: true, ran: false, reason: `未到运行时刻（UTC ${settings.runHourUtc}:00）` })
  }

  const last = settings.lastRunAt
  if (last && last.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)) {
    return NextResponse.json({ ok: true, ran: false, reason: "今天已运行" })
  }

  await storageService.updateSchedulerSettings({ lastRunAt: now })
  const results = await crawlerRunner.runAll("scheduled")

  return NextResponse.json({
    ok: true,
    ran: true,
    results: results.map((r) => ({
      registrar: r.registrarSlug,
      status: r.status,
      totalTlds: r.totalTlds,
      updated: r.updated,
      durationMs: r.durationMs,
    })),
  })
}
