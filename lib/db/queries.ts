import { and, asc, count, desc, eq, max, min, sql, type SQL } from "drizzle-orm"
import { db } from "@/lib/db"
import { crawlJobs, prices, registrars, tlds } from "@/lib/db/schema"
import { getUsdRates } from "@/lib/fx"

/** 站点统计 */
export async function getStats() {
  const [row] = await db
    .select({
      registrarCount: sql<number>`(SELECT count(*) FROM ${registrars} WHERE ${registrars.isActive} = true)`,
      tldCount: sql<number>`(SELECT count(*) FROM ${tlds} WHERE ${tlds.isValid} = true)`,
      priceCount: sql<number>`(SELECT count(*) FROM ${prices})`,
      lastUpdated: sql<string | null>`(SELECT max(${prices.updatedAt}) FROM ${prices})`,
    })
    .from(sql`(SELECT 1) AS one`)
  return row
}

/**
 * 用实时汇率(exchangerate-api.com,DB 智能缓存)动态生成折算 USD 的 SQL 表达式。
 * 汇率为 1 USD = rates[X],故 X 货币金额 → USD 需除以 rates[X]。
 */
async function usdEquivalentExpr(): Promise<SQL<string>> {
  const rates = await getUsdRates()
  const currencies = ["EUR", "CHF", "GBP", "JPY", "SEK", "NOK", "NZD", "CAD", "CNY", "AUD", "HKD", "SGD"]
  const cases: SQL[] = []
  for (const c of currencies) {
    const r = rates[c]
    if (r && r > 0) cases.push(sql`WHEN ${c} THEN ${sql.raw((1 / r).toFixed(6))}`)
  }
  return sql<string>`${prices.registerPrice} * (CASE ${prices.currency}
  WHEN 'USD' THEN 1
  ${sql.join(cases, sql` `)}
  ELSE 1 END)`
}

/**
 * 全部后缀 + 每个后缀的最低注册价（实时汇率折算 USD，仅统计启用的注册商）。
 * 折算后低于 $1 的价格视为首年促销/占位价（如日元 1 円活动），不参与最低价展示。
 * 只返回 IANA 认可的有效后缀，按热度分降序排列。
 */
export async function getTldsWithMinPrice(onlyPopular = false) {
  const usdEquivalent = await usdEquivalentExpr()
  const rows = await db
    .select({
      id: tlds.id,
      tld: tlds.tld,
      type: tlds.type,
      isPopular: tlds.isPopular,
      popularity: tlds.popularity,
      minRegister: min(sql<string>`CASE WHEN ${usdEquivalent} >= 1 THEN ${usdEquivalent} ELSE NULL END`),
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
    .where(
      onlyPopular ? and(eq(tlds.isValid, true), eq(tlds.isPopular, true)) : eq(tlds.isValid, true),
    )
    .groupBy(tlds.id)
    .orderBy(desc(tlds.popularity), desc(count(prices.id)), asc(tlds.tld))
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
