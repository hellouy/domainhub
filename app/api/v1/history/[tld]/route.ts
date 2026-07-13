import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { tlds } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { createApiHandler } from "@/lib/api/handler"
import { cacheService, CACHE_TAGS, TTL } from "@/services/cache"

export const dynamic = "force-dynamic"

/** 支持的时间范围（Sprint 4 Part 3） */
const RANGES: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 }

/**
 * GET /api/v1/history/{tld}?range=30d
 * 单后缀的历史价格按天聚合：最低/最高/平均注册价 + 当天价格变动次数。
 * 查询参数：
 * - range:     7d | 30d | 90d | 365d（默认 30d）
 * - registrar: 可选，按注册商 slug 过滤
 */
export const GET = createApiHandler("/api/v1/history/{tld}", async (request, { params }) => {
  const { tld: rawTld } = await params
  const tldName = decodeURIComponent(rawTld).replace(/^\./, "").toLowerCase().slice(0, 63)
  if (!/^[a-z0-9.-]+$/.test(tldName)) {
    return NextResponse.json({ error: "tld 参数格式非法" }, { status: 400 })
  }

  const url = new URL(request.url)
  const rangeKey = url.searchParams.get("range") ?? "30d"
  const days = RANGES[rangeKey]
  if (!days) {
    return NextResponse.json({ error: "range 仅支持 7d / 30d / 90d / 365d" }, { status: 400 })
  }
  const registrarFilter = url.searchParams.get("registrar")?.toLowerCase().slice(0, 63) ?? null
  if (registrarFilter && !/^[a-z0-9-]+$/.test(registrarFilter)) {
    return NextResponse.json({ error: "registrar 参数格式非法" }, { status: 400 })
  }

  const cacheKey = `api:v1:history:${tldName}:${rangeKey}:${registrarFilter ?? ""}`
  const payload = await cacheService.getOrSet(
    cacheKey,
    TTL.stats,
    async () => {
      const [tldRow] = await db.select().from(tlds).where(eq(tlds.tld, tldName)).limit(1)
      if (!tldRow) return null

      // 按天聚合：最低/最高/平均注册价 + 当天变动次数
      const result = await db.execute(sql`
        select
          to_char(date_trunc('day', ph.recorded_at), 'YYYY-MM-DD') as day,
          round(min(ph.register_price), 2) as lowest,
          round(max(ph.register_price), 2) as highest,
          round(avg(ph.register_price), 2) as average,
          count(*)::int as changes
        from price_history ph
        ${registrarFilter ? sql`join registrars r on r.id = ph.registrar_id and r.slug = ${registrarFilter}` : sql``}
        where ph.tld_id = ${tldRow.id}
          and ph.register_price is not null
          and ph.recorded_at >= now() - make_interval(days => ${days})
        group by date_trunc('day', ph.recorded_at)
        order by day asc
      `)

      type DayRow = { day: string; lowest: string; highest: string; average: string; changes: number }
      const daily = (result.rows as DayRow[]) ?? []
      const totalChanges = daily.reduce((acc, d) => acc + Number(d.changes), 0)

      return {
        tld: tldRow.tld,
        range: rangeKey,
        registrar: registrarFilter,
        days: daily.length,
        totalChanges,
        data: daily,
      }
    },
    [CACHE_TAGS.prices],
  )

  if (!payload) {
    return NextResponse.json({ error: `未收录后缀 .${tldName}` }, { status: 404 })
  }
  return NextResponse.json(payload)
})
