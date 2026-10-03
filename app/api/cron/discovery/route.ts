/**
 * GET /api/cron/discovery —— 每日定时注册商发现(Vercel Cron)
 * 鉴权: Authorization: Bearer ${CRON_SECRET}(Vercel Cron 自动携带)
 * 所有权: Platform Team
 *
 * 种子来源(按顺序合并去重):
 *   1. 查询参数 ?urls=a.com,b.com(手动触发时可指定)
 *   2. 候选池里仍为 pending 的 website(重新评分,可能因页面更新而达标)
 *
 * 高信心候选会被自动提升为注册商(isActive=false)并尝试 AI 生成采集规则,
 * 但注册商启用与规则激活仍需人工在后台确认 → 双重把关,不会自动上线脏数据。
 */

import { NextResponse, type NextRequest } from "next/server"
import { db } from "@/lib/db"
import { registrarCandidates } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { orchestrateDiscovery } from "@/services/discovery/orchestrator"

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "未授权" }, { status: 401 })
  }

  // 1. 查询参数指定的 URL
  const urlParam = request.nextUrl.searchParams.get("urls")
  const fromParam = urlParam
    ? urlParam.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
    : []

  // 2. 候选池里仍 pending 的 website(重新评分)
  const pending = await db
    .select({ website: registrarCandidates.website })
    .from(registrarCandidates)
    .where(eq(registrarCandidates.status, "pending"))
  const fromPending = pending.map((p) => p.website)

  const urls = [...new Set([...fromParam, ...fromPending])]

  if (urls.length === 0) {
    return NextResponse.json({ ok: true, message: "无待发现 URL(可用 ?urls= 指定)", discovered: 0 })
  }

  const result = await orchestrateDiscovery(urls, { budgetMs: 270_000 })
  return NextResponse.json({ ok: true, ...result })
}
