import { NextResponse } from "next/server"
import { getUsdRates } from "@/lib/fx"

export const revalidate = 3600

/** GET /api/v1/rates —— USD 基准汇率(货币切换器用),CDN 缓存 1 小时 */
export async function GET() {
  const rates = await getUsdRates()
  return NextResponse.json(
    { apiVersion: "v1", base: "USD", rates },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  )
}
