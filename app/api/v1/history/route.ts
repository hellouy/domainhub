/**
 * GET /api/v1/history —— 价格历史
 * 查询参数: registrar(slug) / tld / days / limit
 * 所有权: API Team, 文档: docs/api.md
 */

import { NextResponse, type NextRequest } from "next/server"
import { queryHistory } from "@/services/prices"

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  try {
    const data = await queryHistory({
      registrar: params.get("registrar") ?? undefined,
      tld: params.get("tld") ?? undefined,
      days: params.get("days") ? Number.parseInt(params.get("days") as string, 10) : undefined,
      limit: params.get("limit") ? Number.parseInt(params.get("limit") as string, 10) : undefined,
    })
    return NextResponse.json({ apiVersion: "v1", count: data.length, data })
  } catch (error) {
    return NextResponse.json(
      { apiVersion: "v1", error: error instanceof Error ? error.message : "查询失败" },
      { status: 500 },
    )
  }
}
