import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { prices, registrars, tlds } from "@/lib/db/schema"
import { asc, desc, eq } from "drizzle-orm"
import { createApiHandler } from "@/lib/api/handler"
import { cacheService, CACHE_TAGS, TTL } from "@/services/cache"

export const dynamic = "force-dynamic"

/**
 * GET /api/v1/prices/{tld}
 * 返回单个后缀在全部注册商的价格。
 * 查询参数：
 * - sort:  register | renew | transfer（默认 register）
 * - order: asc | desc（默认 asc）
 */
export const GET = createApiHandler("/api/v1/prices/{tld}", async (request, { params }) => {
  const { tld: rawTld } = await params
  const tldName = decodeURIComponent(rawTld).replace(/^\./, "").toLowerCase().slice(0, 63)
  if (!/^[a-z0-9.-]+$/.test(tldName)) {
    return NextResponse.json({ error: "tld 参数格式非法" }, { status: 400 })
  }

  const url = new URL(request.url)
  const sortKey = url.searchParams.get("sort") ?? "register"
  const order = url.searchParams.get("order") === "desc" ? "desc" : "asc"

  const cacheKey = `api:v1:prices-tld:${tldName}:${sortKey}:${order}`
  const payload = await cacheService.getOrSet(
    cacheKey,
    TTL.api,
    async () => {
      const sortColumn =
        sortKey === "renew" ? prices.renewPrice : sortKey === "transfer" ? prices.transferPrice : prices.registerPrice

      const [tldRow] = await db.select().from(tlds).where(eq(tlds.tld, tldName)).limit(1)
      if (!tldRow) return null

      const rows = await db
        .select({
          registrar: registrars.slug,
          registrarName: registrars.name,
          website: registrars.website,
          registerPrice: prices.registerPrice,
          renewPrice: prices.renewPrice,
          transferPrice: prices.transferPrice,
          currency: prices.currency,
          updatedAt: prices.updatedAt,
        })
        .from(prices)
        .innerJoin(registrars, eq(prices.registrarId, registrars.id))
        .where(eq(prices.tldId, tldRow.id))
        .orderBy(order === "desc" ? desc(sortColumn) : asc(sortColumn))

      return { tld: tldRow.tld, type: tldRow.type, count: rows.length, data: rows }
    },
    [CACHE_TAGS.prices],
  )

  if (!payload) {
    return NextResponse.json({ error: `未收录后缀 .${tldName}` }, { status: 404 })
  }
  return NextResponse.json(payload)
})
