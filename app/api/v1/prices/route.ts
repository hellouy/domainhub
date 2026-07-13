/**
 * GET /api/v1/prices —— 当前价格列表
 * 查询参数: registrar(slug) / tld / limit
 * 所有权: API Team, 文档: docs/api.md
 */

import { NextResponse, type NextRequest } from "next/server"
import { queryPrices } from "@/services/prices"

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  try {
    const data = await queryPrices({
      registrar: params.get("registrar") ?? undefined,
      tld: params.get("tld") ?? undefined,
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
