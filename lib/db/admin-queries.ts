import { and, asc, count, desc, eq, max, sql, type SQL } from "drizzle-orm"
import { db } from "@/lib/db"
import { crawlJobs, prices, registrars, tlds } from "@/lib/db/schema"

/**
 * 后台专用查询集合。与前台 queries.ts 分离，避免相互干扰。
 * 所有金额相关的 numeric 字段以 string 返回，展示层负责格式化。
 */

/** 概览页关键指标 */
export async function getAdminOverview() {
  const [row] = await db
    .select({
      registrarActive: sql<number>`(SELECT count(*)::int FROM ${registrars} WHERE ${registrars.isActive} = true)`,
      registrarTotal: sql<number>`(SELECT count(*)::int FROM ${registrars})`,
      tldValid: sql<number>`(SELECT count(*)::int FROM ${tlds} WHERE ${tlds.isValid} = true)`,
      tldPopular: sql<number>`(SELECT count(*)::int FROM ${tlds} WHERE ${tlds.isPopular} = true)`,
      tldTotal: sql<number>`(SELECT count(*)::int FROM ${tlds})`,
      priceCount: sql<number>`(SELECT count(*)::int FROM ${prices})`,
      lastUpdated: sql<string | null>`(SELECT max(${prices.updatedAt}) FROM ${prices})`,
      jobsSuccess24h: sql<number>`(SELECT count(*)::int FROM ${crawlJobs} WHERE ${crawlJobs.status} = 'success' AND ${crawlJobs.createdAt} > now() - interval '24 hours')`,
      jobsFailed24h: sql<number>`(SELECT count(*)::int FROM ${crawlJobs} WHERE ${crawlJobs.status} = 'failed' AND ${crawlJobs.createdAt} > now() - interval '24 hours')`,
      jobsRunning: sql<number>`(SELECT count(*)::int FROM ${crawlJobs} WHERE ${crawlJobs.status} = 'running')`,
    })
    .from(sql`(SELECT 1) AS one`)
  return row
}

/**
 * 每个注册商的健康行：价格数、覆盖率（相对有效后缀总数）、最近任务状态/时间。
 * 供概览页与注册商页共用。
 */
export async function getRegistrarHealthRows() {
  const validTldCount = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(tlds)
    .where(eq(tlds.isValid, true))
    .then((r) => r[0]?.c ?? 0)

  const rows = await db
    .select({
      id: registrars.id,
      slug: registrars.slug,
      name: registrars.name,
      isActive: registrars.isActive,
      health: registrars.health,
      priceCount: sql<number>`(SELECT count(*)::int FROM ${prices} WHERE ${prices.registrarId} = ${registrars.id})`,
      lastPriceAt: sql<string | null>`(SELECT max(${prices.updatedAt}) FROM ${prices} WHERE ${prices.registrarId} = ${registrars.id})`,
      lastJobStatus: sql<string | null>`(SELECT status FROM ${crawlJobs} WHERE ${crawlJobs.registrarId} = ${registrars.id} ORDER BY ${crawlJobs.createdAt} DESC LIMIT 1)`,
      lastJobAt: sql<string | null>`(SELECT created_at FROM ${crawlJobs} WHERE ${crawlJobs.registrarId} = ${registrars.id} ORDER BY ${crawlJobs.createdAt} DESC LIMIT 1)`,
    })
    .from(registrars)
    .orderBy(desc(registrars.isActive), asc(registrars.name))

  return rows.map((r) => ({
    ...r,
    validTldCount,
    coverage: validTldCount > 0 ? r.priceCount / validTldCount : 0,
  }))
}

/** 价格数据分页搜索（后缀关键词 + 注册商过滤） */
export async function searchPrices(opts: {
  q?: string
  registrarId?: number
  page?: number
  pageSize?: number
}) {
  const page = Math.max(1, opts.page ?? 1)
  const pageSize = Math.min(100, Math.max(10, opts.pageSize ?? 50))
  const conds: SQL[] = []
  if (opts.q) {
    const kw = `%${opts.q.toLowerCase().replace(/^\./, "")}%`
    conds.push(sql`${tlds.tld} ILIKE ${kw}`)
  }
  if (opts.registrarId) conds.push(eq(prices.registrarId, opts.registrarId))
  const where = conds.length ? and(...conds) : undefined

  const rows = await db
    .select({
      priceId: prices.id,
      registrarId: registrars.id,
      registrarName: registrars.name,
      registrarSlug: registrars.slug,
      tldId: tlds.id,
      tld: tlds.tld,
      registerPrice: prices.registerPrice,
      renewPrice: prices.renewPrice,
      transferPrice: prices.transferPrice,
      currency: prices.currency,
      sourceUrl: prices.sourceUrl,
      updatedAt: prices.updatedAt,
    })
    .from(prices)
    .innerJoin(tlds, eq(prices.tldId, tlds.id))
    .innerJoin(registrars, eq(prices.registrarId, registrars.id))
    .where(where)
    .orderBy(asc(tlds.tld), asc(registrars.name))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(prices)
    .innerJoin(tlds, eq(prices.tldId, tlds.id))
    .where(where)

  return { rows, total, page, pageSize }
}

/** 后缀分页搜索（关键词 + 过滤：all/popular/valid/invalid），附带价格覆盖数 */
export async function searchTlds(opts: {
  q?: string
  filter?: "all" | "popular" | "valid" | "invalid"
  page?: number
  pageSize?: number
}) {
  const page = Math.max(1, opts.page ?? 1)
  const pageSize = Math.min(100, Math.max(10, opts.pageSize ?? 50))
  const conds: SQL[] = []
  if (opts.q) conds.push(sql`${tlds.tld} ILIKE ${`%${opts.q.toLowerCase().replace(/^\./, "")}%`}`)
  if (opts.filter === "popular") conds.push(eq(tlds.isPopular, true))
  else if (opts.filter === "valid") conds.push(eq(tlds.isValid, true))
  else if (opts.filter === "invalid") conds.push(eq(tlds.isValid, false))
  const where = conds.length ? and(...conds) : undefined

  const rows = await db
    .select({
      id: tlds.id,
      tld: tlds.tld,
      type: tlds.type,
      description: tlds.description,
      isPopular: tlds.isPopular,
      isValid: tlds.isValid,
      popularity: tlds.popularity,
      priceCount: sql<number>`(SELECT count(*)::int FROM ${prices} WHERE ${prices.tldId} = ${tlds.id})`,
    })
    .from(tlds)
    .where(where)
    .orderBy(desc(tlds.popularity), desc(tlds.isPopular), asc(tlds.tld))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(tlds)
    .where(where)

  return { rows, total, page, pageSize }
}

/** 后缀过滤计数（用于标签页角标） */
export async function getTldCounts() {
  const [row] = await db
    .select({
      all: sql<number>`count(*)::int`,
      popular: sql<number>`count(*) FILTER (WHERE ${tlds.isPopular} = true)::int`,
      valid: sql<number>`count(*) FILTER (WHERE ${tlds.isValid} = true)::int`,
      invalid: sql<number>`count(*) FILTER (WHERE ${tlds.isValid} = false)::int`,
    })
    .from(tlds)
  return row
}

/** 采集任务分页查询（状态 + 注册商过滤） */
export async function getJobsFiltered(opts: {
  status?: string
  registrarId?: number
  limit?: number
}) {
  const limit = Math.min(100, Math.max(10, opts.limit ?? 40))
  const conds: SQL[] = []
  if (opts.status && opts.status !== "all") conds.push(eq(crawlJobs.status, opts.status))
  if (opts.registrarId) conds.push(eq(crawlJobs.registrarId, opts.registrarId))
  const where = conds.length ? and(...conds) : undefined

  const rows = await db
    .select({
      id: crawlJobs.id,
      status: crawlJobs.status,
      trigger: crawlJobs.trigger,
      strategy: crawlJobs.strategy,
      metrics: crawlJobs.metrics,
      startedAt: crawlJobs.startedAt,
      finishedAt: crawlJobs.finishedAt,
      pricesUpdated: crawlJobs.pricesUpdated,
      totalTlds: crawlJobs.totalTlds,
      errorMessage: crawlJobs.errorMessage,
      createdAt: crawlJobs.createdAt,
      registrarName: registrars.name,
      registrarSlug: registrars.slug,
    })
    .from(crawlJobs)
    .innerJoin(registrars, eq(crawlJobs.registrarId, registrars.id))
    .where(where)
    .orderBy(desc(crawlJobs.createdAt))
    .limit(limit)
  return rows
}

/** 采集任务统计（用于顶部指标） */
export async function getJobStats() {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      success: sql<number>`count(*) FILTER (WHERE ${crawlJobs.status} = 'success')::int`,
      failed: sql<number>`count(*) FILTER (WHERE ${crawlJobs.status} = 'failed')::int`,
      running: sql<number>`count(*) FILTER (WHERE ${crawlJobs.status} = 'running')::int`,
    })
    .from(crawlJobs)
  return row
}

/** 注册商下拉选项（全部，用于过滤器） */
export async function getRegistrarOptions() {
  return db
    .select({ id: registrars.id, name: registrars.name, slug: registrars.slug })
    .from(registrars)
    .orderBy(asc(registrars.name))
}
