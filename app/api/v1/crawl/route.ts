/**
 * POST /api/v1/crawl —— 触发采集(需管理员会话)
 * Body: { registrar?: string } —— 省略时全部激活注册商入队并执行
 * 所有权: API Team, 文档: docs/api.md
 */

import { eq } from "drizzle-orm"
import { NextResponse, type NextRequest } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { runCrawlJob } from "@/lib/crawler/runner"
import { db } from "@/lib/db"
import { registrars } from "@/lib/db/schema"
import { getQueue } from "@/packages/queue"
import { drainQueue, scheduleAll } from "@/packages/scheduler"

export const maxDuration = 300

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ apiVersion: "v1", error: "未授权" }, { status: 401 })
  }

  let body: { registrar?: string } = {}
  try {
    body = await request.json()
  } catch {
    // 空 body 视为全量采集
  }

  try {
    if (body.registrar) {
      const [registrar] = await db
        .select({ id: registrars.id, priority: registrars.priority })
        .from(registrars)
        .where(eq(registrars.slug, body.registrar))
      if (!registrar) {
        return NextResponse.json({ apiVersion: "v1", error: "注册商不存在" }, { status: 404 })
      }
      await getQueue().enqueue({
        registrarId: registrar.id,
        priority: registrar.priority ?? 100,
        trigger: "api",
      })
    } else {
      await scheduleAll("api")
    }

    const result = await drainQueue(async (registrarId) => {
      const res = await runCrawlJob(registrarId)
      return { ok: res.ok, error: res.error }
    })

    return NextResponse.json({ apiVersion: "v1", data: result })
  } catch (error) {
    return NextResponse.json(
      { apiVersion: "v1", error: error instanceof Error ? error.message : "采集失败" },
      { status: 500 },
    )
  }
}
