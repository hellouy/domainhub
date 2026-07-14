/**
 * GET /api/cron/replicate —— Neon → Supabase 单向同步（Vercel Cron）
 * 鉴权: Authorization: Bearer ${CRON_SECRET}（Vercel Cron 自动携带）
 * 所有权: Platform Team
 *
 * 未配置 REPLICA_DATABASE_URL 时空转返回 skipped。
 */
import { NextResponse, type NextRequest } from "next/server"
import { runReplication } from "@/services/replication/sync"

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "未授权" }, { status: 401 })
  }

  const result = await runReplication()
  return NextResponse.json(result, { status: result.ok ? 200 : result.error?.includes("跳过") ? 200 : 500 })
}
