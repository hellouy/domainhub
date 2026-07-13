/**
 * GET /api/v1/statistics —— 平台统计
 * 所有权: API Team, 文档: docs/api.md
 */

import { NextResponse } from "next/server"
import { queryStatistics } from "@/services/prices"

export async function GET() {
  try {
    const data = await queryStatistics()
    return NextResponse.json({ apiVersion: "v1", data })
  } catch (error) {
    return NextResponse.json(
      { apiVersion: "v1", error: error instanceof Error ? error.message : "查询失败" },
      { status: 500 },
    )
  }
}
