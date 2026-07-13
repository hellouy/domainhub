import "server-only"

import { db } from "@/lib/db"
import { crawlJobs, prices, registrars, tlds } from "@/lib/db/schema"
import { desc, eq, sql } from "drizzle-orm"

/**
 * 后台统计查询：数据质量 / 调度 / 价格情报。
 * 只读聚合查询，与采集引擎解耦。
 */

// ---------- 数据质量 ----------

export interface RegistrarQuality {
  id: number
  name: string
  slug: string
  isActive: boolean
  /** 最近一次任务状态（无任务时为 null） */
  latestStatus: string | null
  latestJobAt: Date | null
  latestError: string | null
  /** 价格行数 */
  priceCount: number
  /** 覆盖率（价格行数 / tlds 总数） */
  coveragePct: number
  /** 最近一次成功采集时间 */
  lastSuccessAt: Date | null
}

export async function getDataQuality() {
  const [tldCountRow] = await db.select({ count: sql<number>`count(*)::int` }).from(tlds)
  const tldCount = tldCountRow?.count ?? 0

  const allRegistrars = await db.select().from(registrars).orderBy(registrars.name)

  // 每个注册商的价格行数与异常统计
  const priceStats = await db
    .select({
      registrarId: prices.registrarId,
      count: sql<number>`count(*)::int`,
      missingRegister: sql<number>`count(*) filter (where ${prices.registerPrice} is null)::int`,
      invalid: sql<number>`count(*) filter (where ${prices.registerPrice} <= 0 or ${prices.renewPrice} <= 0 or ${prices.transferPrice} <= 0)::int`,
    })
    .from(prices)
    .groupBy(prices.registrarId)
  const priceMap = new Map(priceStats.map((p) => [p.registrarId, p]))

  // 重复检测（registrar_id + tld_id 有唯一约束，理论为 0，仍然核查）
  const [dupRow] = await db
    .select({ count: sql<number>`coalesce(sum(cnt - 1), 0)::int` })
    .from(
      db
        .select({ cnt: sql<number>`count(*)`.as("cnt") })
        .from(prices)
        .groupBy(prices.registrarId, prices.tldId)
        .having(sql`count(*) > 1`)
        .as("dups"),
    )

  // 每个注册商最近一次任务与最近一次成功任务
  const jobs = await db
    .select({
      registrarId: crawlJobs.registrarId,
      status: crawlJobs.status,
      createdAt: crawlJobs.createdAt,
      errorMessage: crawlJobs.errorMessage,
    })
    .from(crawlJobs)
    .orderBy(desc(crawlJobs.id))
  const latestJob = new Map<number, (typeof jobs)[number]>()
  const lastSuccess = new Map<number, Date>()
  for (const job of jobs) {
    if (!latestJob.has(job.registrarId)) latestJob.set(job.registrarId, job)
    if (!lastSuccess.has(job.registrarId) && (job.status === "success" || job.status === "warning")) {
      lastSuccess.set(job.registrarId, job.createdAt)
    }
  }

  const perRegistrar: RegistrarQuality[] = allRegistrars.map((r) => {
    const stat = priceMap.get(r.id)
    const job = latestJob.get(r.id)
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      isActive: r.isActive,
      latestStatus: job?.status ?? null,
      latestJobAt: job?.createdAt ?? null,
      latestError: job?.errorMessage ?? null,
      priceCount: stat?.count ?? 0,
      coveragePct: tldCount > 0 ? Math.round(((stat?.count ?? 0) / tldCount) * 100) : 0,
      lastSuccessAt: lastSuccess.get(r.id) ?? null,
    }
  })

  const totals = {
    adapters: allRegistrars.length,
    healthy: perRegistrar.filter((r) => r.latestStatus === "success").length,
    warning: perRegistrar.filter((r) => r.latestStatus === "warning").length,
    failed: perRegistrar.filter((r) => r.latestStatus === "failed" || r.latestStatus === "cancelled").length,
    totalTlds: tldCount,
    totalPrices: priceStats.reduce((acc, p) => acc + p.count, 0),
    missingPrices: priceStats.reduce((acc, p) => acc + p.missingRegister, 0),
    invalidPrices: priceStats.reduce((acc, p) => acc + p.invalid, 0),
    duplicatePrices: dupRow?.count ?? 0,
    lastSuccessAt: [...lastSuccess.values()].sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
    coveragePct:
      tldCount > 0 && allRegistrars.length > 0
        ? Math.round((priceStats.reduce((acc, p) => acc + p.count, 0) / (tldCount * allRegistrars.length)) * 100)
        : 0,
  }

  return { totals, perRegistrar }
}

// ---------- 调度统计 ----------

export async function getSchedulerStats() {
  const [durationRow] = await db
    .select({
      avgMs: sql<number>`coalesce(avg(extract(epoch from (${crawlJobs.finishedAt} - ${crawlJobs.startedAt})) * 1000), 0)::int`,
    })
    .from(crawlJobs)
    .where(sql`${crawlJobs.finishedAt} is not null and ${crawlJobs.startedAt} is not null`)

  const history = await db
    .select({
      id: crawlJobs.id,
      status: crawlJobs.status,
      trigger: crawlJobs.trigger,
      startedAt: crawlJobs.startedAt,
      finishedAt: crawlJobs.finishedAt,
      pricesUpdated: crawlJobs.pricesUpdated,
      totalTlds: crawlJobs.totalTlds,
      retries: crawlJobs.retries,
      rowsInserted: crawlJobs.rowsInserted,
      rowsUpdated: crawlJobs.rowsUpdated,
      rowsSkipped: crawlJobs.rowsSkipped,
      rowsRejected: crawlJobs.rowsRejected,
      errorMessage: crawlJobs.errorMessage,
      createdAt: crawlJobs.createdAt,
      registrarName: registrars.name,
    })
    .from(crawlJobs)
    .leftJoin(registrars, eq(crawlJobs.registrarId, registrars.id))
    .orderBy(desc(crawlJobs.id))
    .limit(30)

  return { avgDurationMs: durationRow?.avgMs ?? 0, history }
}

// ---------- 价格情报 ----------

export async function getPriceIntelligence() {
  // 注册商平均价（以美元价格行计算）
  const registrarAverages = await db
    .select({
      registrarId: prices.registrarId,
      name: registrars.name,
      slug: registrars.slug,
      avgRegister: sql<string>`round(avg(${prices.registerPrice}), 2)`,
      count: sql<number>`count(*)::int`,
    })
    .from(prices)
    .innerJoin(registrars, eq(prices.registrarId, registrars.id))
    .where(sql`${prices.registerPrice} is not null and ${prices.currency} = 'USD'`)
    .groupBy(prices.registrarId, registrars.name, registrars.slug)
    .having(sql`count(*) >= 5`)
    .orderBy(sql`avg(${prices.registerPrice}) asc`)

  const [overall] = await db
    .select({
      avgRegister: sql<string>`round(avg(${prices.registerPrice}), 2)`,
      avgRenew: sql<string>`round(avg(${prices.renewPrice}), 2)`,
      avgTransfer: sql<string>`round(avg(${prices.transferPrice}), 2)`,
      total: sql<number>`count(*)::int`,
    })
    .from(prices)
    .where(sql`${prices.currency} = 'USD'`)

  // 今日价格变动（基于 price_history 当天记录数）
  const changesTodayResult = await db.execute(
    sql`select count(*)::int as count from price_history where recorded_at >= date_trunc('day', now())`,
  )
  const changesToday = Number((changesTodayResult.rows[0] as { count?: number } | undefined)?.count ?? 0)

  // 涨跌幅 Top：对比每个 registrar+tld 最近两条历史记录
  const movementsResult = await db.execute(sql`
    with ranked as (
      select
        ph.registrar_id, ph.tld_id, ph.register_price, ph.recorded_at,
        row_number() over (partition by ph.registrar_id, ph.tld_id order by ph.recorded_at desc) as rn
      from price_history ph
      where ph.register_price is not null
    )
    select
      r.name as registrar_name,
      t.tld,
      prev.register_price as old_price,
      cur.register_price as new_price,
      (cur.register_price - prev.register_price) as diff
    from ranked cur
    join ranked prev on prev.registrar_id = cur.registrar_id and prev.tld_id = cur.tld_id and prev.rn = 2
    join registrars r on r.id = cur.registrar_id
    join tlds t on t.id = cur.tld_id
    where cur.rn = 1 and cur.register_price <> prev.register_price
    order by abs(cur.register_price - prev.register_price) desc
    limit 20
  `)

  type Movement = { registrar_name: string; tld: string; old_price: string; new_price: string; diff: string }
  const typed = (movementsResult.rows as Movement[]) ?? []
  const drops = typed.filter((m) => Number(m.diff) < 0).slice(0, 5)
  const increases = typed.filter((m) => Number(m.diff) > 0).slice(0, 5)

  return {
    cheapest: registrarAverages[0] ?? null,
    mostExpensive: registrarAverages[registrarAverages.length - 1] ?? null,
    registrarAverages,
    overall: overall ?? { avgRegister: "0", avgRenew: "0", avgTransfer: "0", total: 0 },
    changesToday,
    drops,
    increases,
  }
}
