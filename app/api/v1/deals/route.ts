/**
 * GET /api/v1/deals —— 有效促销/特价列表（deals-and-coupons）
 * 查询参数: registrar / tld / onlyActive(默认true) / limit
 * 展示: 促销价升序, 标注注册商、后缀、优惠码与截止时间。
 * 所有权: API Team, 文档: docs/api.md
 */
import { NextResponse, type NextRequest } from "next/server"
import { queryDeals } from "@/services/prices"

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  try {
    const data = await queryDeals({
      registrar: params.get("registrar") ?? undefined,
      tld: params.get("tld") ?? undefined,
      onlyActive: params.get("onlyActive") !== "false",
      limit: params.get("limit") ? Number.parseInt(params.get("limit") as string, 10) : undefined,
    })
    return NextResponse.json(
      { apiVersion: "v1", count: data.length, data },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        },
      },
    )
  } catch (error) {
    return NextResponse.json(
      { apiVersion: "v1", error: error instanceof Error ? error.message : "查询失败" },
      { status: 500 },
    )
  }
}