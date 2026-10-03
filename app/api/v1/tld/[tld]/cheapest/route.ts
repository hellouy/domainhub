/**
 * GET /api/v1/tld/[tld]/cheapest —— 某后缀最便宜注册商排名（deals-and-coupons）
 * 口径: 有促销取促销价, 无则标准注册价（effectivePrice），按升序返回。
 * 所有权: API Team
 */
import { NextResponse } from "next/server"
import { queryCheapest } from "@/services/prices"

export async function GET(_request: Request, { params }: { params: { tld: string } }) {
  try {
    const result = await queryCheapest(params.tld)
    return NextResponse.json(
      { apiVersion: "v1", ...result },
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