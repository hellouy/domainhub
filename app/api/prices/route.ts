import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { prices, registrars, tlds } from "@/lib/db/schema"
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm"

export const dynamic = "force-dynamic"

const SORTABLE = {
  register: prices.registerPrice,
  renew: prices.renewPrice,
  transfer: prices.transferPrice,
  updated: prices.updatedAt,
  tld: tlds.tld,
} as const

/**
 * GET /api/prices
 * 查询参数：
 * - tld:       按后缀过滤（如 com）
 * - registrar: 按注册商 slug 过滤（如 cloudflare）
 * - sort:      register | renew | transfer | updated | tld（默认 tld）
 * - order:     asc | desc（默认 asc）
 * - page:      页码，从 1 开始（默认 1）
 * - limit:     每页数量，1-100（默认 50）
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const tldFilter = url.searchParams.get("tld")?.replace(/^\./, "").toLowerCase()
  const registrarFilter = url.searchParams.get("registrar")?.toLowerCase()
  const sortKey = (url.searchParams.get("sort") ?? "tld") as keyof typeof SORTABLE
  const order = url.searchParams.get("order") === "desc" ? "desc" : "asc"
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1)
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50))

  const sortColumn = SORTABLE[sortKey] ?? SORTABLE.tld

  const conditions: SQL[] = []
  if (tldFilter) conditions.push(eq(tlds.tld, tldFilter))
  if (registrarFilter) conditions.push(eq(registrars.slug, registrarFilter))
  const where = conditions.length > 0 ? and(...conditions) : undefined

  const base = db
    .select({
      tld: tlds.tld,
      registrar: registrars.slug,
      registrarName: registrars.name,
      registerPrice: prices.registerPrice,
      renewPrice: prices.renewPrice,
      transferPrice: prices.transferPrice,
      currency: prices.currency,
      updatedAt: prices.updatedAt,
    })
    .from(prices)
    .innerJoin(tlds, eq(prices.tldId, tlds.id))
    .innerJoin(registrars, eq(prices.registrarId, registrars.id))

  const countQuery = db
    .select({ count: sql<number>`count(*)::int` })
    .from(prices)
    .innerJoin(tlds, eq(prices.tldId, tlds.id))
    .innerJoin(registrars, eq(prices.registrarId, registrars.id))

  const [rows, countRows] = await Promise.all([
    (where ? base.where(where) : base)
      .orderBy(order === "desc" ? desc(sortColumn) : asc(sortColumn))
      .limit(limit)
      .offset((page - 1) * limit),
    where ? countQuery.where(where) : countQuery,
  ])

  const total = countRows[0]?.count ?? 0

  return NextResponse.json({
    data: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
}
