/**
 * GET /api/v1/registrars —— 注册商列表(含健康/能力/适配器版本)
 * 所有权: API Team, 文档: docs/api.md
 */

import { NextResponse } from "next/server"
import { queryRegistrars } from "@/services/prices"

export async function GET() {
  try {
    const data = await queryRegistrars()
    return NextResponse.json({ apiVersion: "v1", count: data.length, data })
  } catch (error) {
    return NextResponse.json(
      { apiVersion: "v1", error: error instanceof Error ? error.message : "查询失败" },
      { status: 500 },
    )
  }
}
