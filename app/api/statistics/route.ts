import { NextResponse } from "next/server"
import { getPriceIntelligence } from "@/lib/db/admin-queries"

export const dynamic = "force-dynamic"

/**
 * GET /api/statistics
 * 平台级价格统计：均价、最便宜/最贵注册商、今日变动、涨跌 Top。
 */
export async function GET() {
  const intel = await getPriceIntelligence()

  return NextResponse.json({
    overall: {
      averageRegisterPrice: intel.overall.avgRegister,
      averageRenewPrice: intel.overall.avgRenew,
      averageTransferPrice: intel.overall.avgTransfer,
      totalPriceRecords: intel.overall.total,
      priceChangesToday: intel.changesToday,
    },
    cheapestRegistrar: intel.cheapest
      ? { slug: intel.cheapest.slug, name: intel.cheapest.name, averageRegisterPrice: intel.cheapest.avgRegister }
      : null,
    mostExpensiveRegistrar: intel.mostExpensive
      ? {
          slug: intel.mostExpensive.slug,
          name: intel.mostExpensive.name,
          averageRegisterPrice: intel.mostExpensive.avgRegister,
        }
      : null,
    topPriceDrops: intel.drops.map((m) => ({
      tld: m.tld,
      registrar: m.registrar_name,
      oldPrice: m.old_price,
      newPrice: m.new_price,
      change: m.diff,
    })),
    topPriceIncreases: intel.increases.map((m) => ({
      tld: m.tld,
      registrar: m.registrar_name,
      oldPrice: m.old_price,
      newPrice: m.new_price,
      change: m.diff,
    })),
  })
}
