/**
 * GET /api/v1/tld/[tld]/prices —— 某后缀最低价格汇总
 * 返回注册/续费/转移的最低价及其注册商信息
 */
import { NextResponse } from "next/server"
import { queryTldPriceInfo } from "@/services/prices"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tld: string }> },
) {
  try {
    const { tld } = await params
    const result = await queryTldPriceInfo(tld)
    if (!result) {
      return NextResponse.json(
        { apiVersion: "v1", error: "未找到该后缀的价格信息" },
        { status: 404 },
      )
    }
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
