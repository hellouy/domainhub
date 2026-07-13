import { and, asc, count, desc, eq, inArray, max, min, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { crawlJobs, prices, registrars, tlds } from "@/lib/db/schema"

export type PopularTldPrice = {
  registrarSlug: string
  registrarName: string
  registrarWebsite: string
  registerPrice: string | null
  renewPrice: string | null
  transferPrice: string | null
  currency: string
  sourceUrl: string | null
}

export type PopularTldWithPrices = {
  id: number
  tld: string
  type: string
  registrarCount: number
  prices: PopularTldPrice[]
}

/**
 * 热门后缀 + 各注册商价格（供首页内联展开比价，避免逐层跳转）。
 * 一次性取回所有热门后缀的价格，前端按选定币种换算、排序、取最低价。
 */
export async function getPopularTldsWithPrices(): Promise<PopularTldWithPrices[]> {
  const popular = await db
    .select({ id: tlds.id, tld: tlds.tld, type: tlds.type })
    .from(tlds)
    .where(eq(tlds.isPopular, true))
    .orderBy(asc(tlds.tld))

  if (popular.length === 0) return []

  const ids = popular.map((t) => t.id)
  const priceRows = await db
    .select({
      tldId: prices.tldId,
      registrarSlug: registrars.slug,
      registrarName: registrars.name,
      registrarWebsite: registrars.website,
      registerPrice: prices.registerPrice,
      renewPrice: prices.renewPrice,
      transferPrice: prices.transferPrice,
      currency: prices.currency,
      sourceUrl: prices.sourceUrl,
    })
    .from(prices)
    .innerJoin(registrars, and(eq(prices.registrarId, registrars.id), eq(registrars.isActive, true)))
    .where(inArray(prices.tldId, ids))

  const byTld = new Map<number, PopularTldPrice[]>()
  for (const row of priceRows) {
    const list = byTld.get(row.tldId) ?? []
    list.push({
      registrarSlug: row.registrarSlug,
      registrarName: row.registrarName,
      registrarWebsite: row.registrarWebsite,
      registerPrice: row.registerPrice,
      renewPrice: row.renewPrice,
      transferPrice: row.transferPrice,
      currency: row.currency,
      sourceUrl: row.sourceUrl,
    })
    byTld.set(row.tldId, list)
  }

  return popular.map((t) => ({
    id: t.id,
    tld: t.tld,
    type: t.type,
    registrarCount: byTld.get(t.id)?.length ?? 0,
    prices: byTld.get(t.id) ?? [],
  }))
}

/** 站点统计 */
export async function getStats() {
  const [row] = await db
    .select({
      registrarCount: sql<number>`(SELECT count(*) FROM ${registrars} WHERE ${registrars.isActive} = true)`,
      tldCount: sql<number>`(SELECT count(*) FROM ${tlds})`,
      priceCount: sql<number>`(SELECT count(*) FROM ${prices})`,
      lastUpdated: sql<string | null>`(SELECT max(${prices.updatedAt}) FROM ${prices})`,
    })
    .from(sql`(SELECT 1) AS one`)
  return row
}

/** 全部后缀 + 每个后缀的最低注册价（仅统计启用的注册商） */
export async function getTldsWithMinPrice(onlyPopular = false) {
  const rows = await db
    .select({
      id: tlds.id,
      tld: tlds.tld,
      type: tlds.type,
      isPopular: tlds.isPopular,
      minRegister: min(prices.registerPrice),
      registrarCount: count(prices.id),
    })
    .from(tlds)
    .leftJoin(
      prices,
      and(
        eq(prices.tldId, tlds.id),
        sql`${prices.registrarId} IN (SELECT id FROM ${registrars} WHERE ${registrars.isActive} = true)`,
      ),
    )
    .where(onlyPopular ? eq(tlds.isPopular, true) : undefined)
    .groupBy(tlds.id)
    .orderBy(asc(tlds.tld))
  return rows
}

/** 启用的注册商列表 + 支持后缀数 */
export async function getActiveRegistrars() {
  const rows = await db
    .select({
      id: registrars.id,
      slug: registrars.slug,
      name: registrars.name,
      website: registrars.website,
      description: registrars.description,
      icannAccredited: registrars.icannAccredited,
      whoisPrivacy: registrars.whoisPrivacy,
      dnssec: registrars.dnssec,
      tldCount: count(prices.id),
    })
    .from(registrars)
    .leftJoin(prices, eq(prices.registrarId, registrars.id))
    .where(eq(registrars.isActive, true))
    .groupBy(registrars.id)
    .orderBy(asc(registrars.name))
  return rows
}

/** 后缀详情：后缀信息 */
export async function getTldByName(tld: string) {
  const [row] = await db.select().from(tlds).where(eq(tlds.tld, tld.toLowerCase())).limit(1)
  return row ?? null
}

/** 某后缀下全部启用注册商的价格 */
export async function getPricesForTld(tldId: number) {
  const rows = await db
    .select({
      priceId: prices.id,
      registerPrice: prices.registerPrice,
      renewPrice: prices.renewPrice,
      transferPrice: prices.transferPrice,
      currency: prices.currency,
      sourceUrl: prices.sourceUrl,
      updatedAt: prices.updatedAt,
      registrarId: registrars.id,
      registrarSlug: registrars.slug,
      registrarName: registrars.name,
      registrarWebsite: registrars.website,
    })
    .from(prices)
    .innerJoin(registrars, and(eq(prices.registrarId, registrars.id), eq(registrars.isActive, true)))
    .where(eq(prices.tldId, tldId))
    .orderBy(sql`${prices.registerPrice} ASC NULLS LAST`)
  return rows
}

/** 注册商详情 */
export async function getRegistrarBySlug(slug: string) {
  const [row] = await db.select().from(registrars).where(eq(registrars.slug, slug)).limit(1)
  return row ?? null
}

/** 某注册商全部后缀价格 */
export async function getPricesForRegistrar(registrarId: number) {
  const rows = await db
    .select({
      priceId: prices.id,
      registerPrice: prices.registerPrice,
      renewPrice: prices.renewPrice,
      transferPrice: prices.transferPrice,
      currency: prices.currency,
      updatedAt: prices.updatedAt,
      tldId: tlds.id,
      tld: tlds.tld,
      tldType: tlds.type,
    })
    .from(prices)
    .innerJoin(tlds, eq(prices.tldId, tlds.id))
    .where(eq(prices.registrarId, registrarId))
    .orderBy(asc(tlds.tld))
  return rows
}

/** 后缀的最近价格更新时间 */
export async function getTldLastUpdated(tldId: number) {
  const [row] = await db
    .select({ lastUpdated: max(prices.updatedAt) })
    .from(prices)
    .where(eq(prices.tldId, tldId))
  return row?.lastUpdated ?? null
}

/** 最近成功的采集任务（供首页“数据更新”展示） */
export async function getRecentJobs(limit = 10) {
  const rows = await db
    .select({
      id: crawlJobs.id,
      status: crawlJobs.status,
      trigger: crawlJobs.trigger,
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
    .orderBy(desc(crawlJobs.createdAt))
    .limit(limit)
  return rows
}
