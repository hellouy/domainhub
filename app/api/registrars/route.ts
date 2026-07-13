import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { prices, registrars } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"

export const dynamic = "force-dynamic"

/**
 * GET /api/registrars
 * 返回全部启用的注册商及其价格覆盖数。
 * 查询参数：
 * - all: 传 "1" 时包含已停用的注册商
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const includeInactive = url.searchParams.get("all") === "1"

  const rows = await db
    .select({
      slug: registrars.slug,
      name: registrars.name,
      website: registrars.website,
      icannAccredited: registrars.icannAccredited,
      whoisPrivacy: registrars.whoisPrivacy,
      dnssec: registrars.dnssec,
      isActive: registrars.isActive,
      priceCount: sql<number>`count(${prices.id})::int`,
    })
    .from(registrars)
    .leftJoin(prices, eq(prices.registrarId, registrars.id))
    .where(includeInactive ? undefined : eq(registrars.isActive, true))
    .groupBy(registrars.id)
    .orderBy(registrars.name)

  return NextResponse.json({ count: rows.length, data: rows })
}
