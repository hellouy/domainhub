/**
 * GET /api/v1/health —— 各注册商适配器健康快照
 * 所有权: API Team, 文档: docs/api.md
 */

import { NextResponse } from "next/server"
import { queryHealth } from "@/services/prices"

export async function GET() {
  try {
    const data = await queryHealth()
    return NextResponse.json({ apiVersion: "v1", count: data.length, data })
  } catch (error) {
    return NextResponse.json(
      { apiVersion: "v1", error: error instanceof Error ? error.message : "查询失败" },
      { status: 500 },
    )
  }
}
