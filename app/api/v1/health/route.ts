/**
 * GET /api/v1/health —— 各注册商适配器健康快照
 * 所有权: API Team, 文档: docs/api.md
 */

import { NextResponse } from "next/server"
import { getQueryDataSourceState, queryHealth } from "@/services/prices"

export async function GET() {
  try {
    const data = await queryHealth()
    const dataSource = getQueryDataSourceState()
    return NextResponse.json(
      { apiVersion: "v1", count: data.length, data, dataSource },
      {
        status: dataSource.source === "database" ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    )
  } catch (error) {
    return NextResponse.json(
      { apiVersion: "v1", error: error instanceof Error ? error.message : "查询失败" },
      { status: 500 },
    )
  }
}
