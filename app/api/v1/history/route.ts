/**
 * GET /api/v1/history —— 价格历史
 * 查询参数: registrar(slug) / tld / days / limit
 * 所有权: API Team, 文档: docs/api.md
 */

import { NextResponse, type NextRequest } from "next/server"
import { queryHistory } from "@/services/prices"

/** 解析正整数查询参数,非法或非正数时返回 undefined */
function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  try {
    const data = await queryHistory({
      registrar: params.get("registrar") ?? undefined,
      tld: params.get("tld") ?? undefined,
      days: parsePositiveInt(params.get("days")),
      limit: parsePositiveInt(params.get("limit")),
    })
    return NextResponse.json({ apiVersion: "v1", count: data.length, data })
  } catch (error) {
    return NextResponse.json(
      { apiVersion: "v1", error: error instanceof Error ? error.message : "查询失败" },
      { status: 500 },
    )
  }
}
