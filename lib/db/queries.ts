import { and, asc, count, desc, eq, max, min, ne, sql, type SQL, type SQLWrapper } from "drizzle-orm"
import { db } from "@/lib/db"
import { crawlJobs, prices, registrars, tlds } from "@/lib/db/schema"
import { computeRegistrarScore, type RegistrarScoreBreakdown } from "@/lib/registrar-score"
import { getUsdRates } from "@/lib/fx"
import { PLACEHOLDER_MAX } from "@/lib/pricing"
import {
  seedActiveRegistrars,
  seedPricesForRegistrar,
  seedPricesForTld,
  seedRegistrarBySlug,
  seedStats,
  seedTldByName,
  seedTldLastUpdated,
  seedTldsWithMinPrice,
} from "@/lib/db/seed-fallbacks"

/**
 * 前台查询统一容错包装:数据库不可用时回退到默认值,避免整站 500。
 * 与 lib/site-settings.ts 的兜底策略保持一致,保证公共页面永不因 DB 挂掉而崩溃。
 */
async function safeQuery<T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run()
  } catch (err) {
    console.error(`[db] ${label} failed, returning fallback:`, err)
    return fallback
  }
}

/** 站点统计 */
export type StatsRow = {
  registrarCount: number
  tldCount: number
  priceCount: number
  lastUpdated: string | null
}

export async function getStats(): Promise<StatsRow> {
  return safeQuery(
    "getStats",
    async () => {
      const [row] = await db
        .select({
          registrarCount: sql<number>`(SELECT count(*) FROM ${registrars} WHERE ${registrars.isActive} = true)`,
          tldCount: sql<number>`(SELECT count(*) FROM ${tlds} WHERE ${tlds.isValid} = true AND ${tlds.type} <> 'newG')`,
          priceCount: sql<number>`(SELECT count(*) FROM ${prices})`,
          lastUpdated: sql<string | null>`(SELECT max(${prices.updatedAt}) FROM ${prices})`,
        })
        .from(sql`(SELECT 1) AS one`)
      return row ?? seedStats()
    },
    seedStats(),
  )
}

/**
 * 用实时汇率(exchangerate-api.com,DB 智能缓存)动态生成折算 USD 的 SQL 表达式。
 * 汇率为 1 USD = rates[X],故 X 货币金额 → USD 需除以 rates[X]。
 */
async function usdEquivalentExpr(price: SQLWrapper = prices.registerPrice): Promise<SQL<string>> {
  const rates = await getUsdRates()
  const cases: SQL[] = []
  for (const [c, r] of Object.entries(rates)) {
    if (c === "USD" || !/^[A-Z]{3}$/.test(c) || !(r > 0)) continue
    cases.push(sql`WHEN ${c} THEN ${sql.raw((1 / r).toPrecision(8))}`)
  }
  // Unknown currencies must yield NULL, never be treated as USD (e.g. 1 NGN ≠ $1).
  return sql<string>`${price} * (CASE ${prices.currency}
  WHEN 'USD' THEN 1
  ${sql.join(cases, sql` `)}
  ELSE NULL END)`
}

/** Scraped "1.00" values are placeholders, not real prices; shared with lib/pricing.ts. */
const notPlaceholder = (price: SQLWrapper) => sql`${price} > ${PLACEHOLDER_MAX}`

/**
 * 全部后缀 + 每个后缀的最低注册价（实时汇率折算 USD，仅统计启用的注册商）。
 * 折算后低于 $1 的价格视为首年促销/占位价（如日元 1 円活动），不参与最低价展示。
 * 只返回 IANA 认可的有效后缀，按热度分降序排列。
 */
export async function getTldsWithMinPrice(onlyPopular = false) {
  return safeQuery(
    "getTldsWithMinPrice",
    async () => {
    const hasActivePromotion = sql<boolean>`
      ${prices.promotionPrice} IS NOT NULL
      AND (${prices.promotionEndsAt} IS NULL OR ${prices.promotionEndsAt} >= now())
      AND ${prices.registerPrice} IS NOT NULL
      AND ${prices.promotionPrice} > 0 AND ${prices.promotionPrice} < ${prices.registerPrice}`
    const effectiveRegisterPrice = sql<string>`CASE
      WHEN ${hasActivePromotion} THEN ${prices.promotionPrice}
      ELSE ${prices.registerPrice}
    END`
    const usdEquivalent = await usdEquivalentExpr(effectiveRegisterPrice)
    const rows = await db
        .select({
          id: tlds.id,
          tld: tlds.tld,
          type: tlds.type,
          isPopular: tlds.isPopular,
          popularity: tlds.popularity,
          minRegister: min(
            sql<string>`CASE WHEN ${notPlaceholder(prices.registerPrice)} AND (${usdEquivalent} >= 1 OR ${hasActivePromotion}) THEN ${usdEquivalent} ELSE NULL END`,
          ),
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
          onlyPopular
            ? and(eq(tlds.isValid, true), eq(tlds.isPopular, true), ne(tlds.type, "newG"))
            : and(eq(tlds.isValid, true), ne(tlds.type, "newG")),
        )
        .groupBy(tlds.id)
        .orderBy(desc(tlds.popularity), desc(count(prices.id)), asc(tlds.tld))
      return rows
    },
    seedTldsWithMinPrice(onlyPopular),
  )
}

export type TldPriceFloor = {
  /** 与首页同一规则的最低首年价（含生效促销），USD */
  lowestUsd: number | null
  /** 全网最低「常规」注册价（不计促销），USD；优惠必须低于它才算优惠 */
  standardUsd: number | null
}

/**
 * 每个后缀的价格底线，规则与 getTldsWithMinPrice / getTldBestQuotes 完全一致，
 * 供优惠页判断"是否真的便宜"，保证全站对同一后缀给出同一个最低价。
 */
export async function getTldPriceFloors(): Promise<Map<string, TldPriceFloor>> {
  return safeQuery(
    "getTldPriceFloors",
    async () => {
      const hasActivePromotion = sql<boolean>`(
        ${prices.promotionPrice} IS NOT NULL
        AND (${prices.promotionEndsAt} IS NULL OR ${prices.promotionEndsAt} >= now())
        AND ${prices.registerPrice} IS NOT NULL
        AND ${prices.promotionPrice} > 0 AND ${prices.promotionPrice} < ${prices.registerPrice})`
      const effective = sql<string>`CASE WHEN ${hasActivePromotion} THEN ${prices.promotionPrice} ELSE ${prices.registerPrice} END`
      const effectiveUsd = await usdEquivalentExpr(effective)
      const standardUsd = await usdEquivalentExpr(prices.registerPrice)
      const rows = await db
        .select({
          tld: tlds.tld,
          lowestUsd: min(
            sql<string>`CASE WHEN ${notPlaceholder(prices.registerPrice)} AND (${effectiveUsd} >= 1 OR ${hasActivePromotion}) THEN ${effectiveUsd} ELSE NULL END`,
          ),
          standardUsd: min(
            sql<string>`CASE WHEN ${notPlaceholder(prices.registerPrice)} AND ${standardUsd} >= 1 THEN ${standardUsd} ELSE NULL END`,
          ),
        })
        .from(prices)
        .innerJoin(registrars, and(eq(registrars.id, prices.registrarId), eq(registrars.isActive, true)))
        .innerJoin(tlds, eq(tlds.id, prices.tldId))
        .groupBy(tlds.tld)
      return new Map(
        rows.map((r) => [
          r.tld,
          {
            lowestUsd: r.lowestUsd == null ? null : Number(r.lowestUsd),
            standardUsd: r.standardUsd == null ? null : Number(r.standardUsd),
          },
        ]),
      )
    },
    new Map(),
  )
}

  export type TldBestQuote = {
  tld: string
  type: string
  isPopular: boolean
  registrarCount: number
  /** 与 minRegister 同一条记录的原始数据，前台按同一汇率折算，保证首页与详情页一致 */
  registrarSlug: string | null
  registrarName: string | null
  currency: string | null
  registerPrice: string | null
  renewPrice: string | null
  promotionPrice: string | null
  promotionEndsAt: string | null
  promoCode: string | null
  sourceUrl: string | null
  }

  /**
   * 首页列表：每个后缀取「生效促销价优先、折算 USD 最低」的那一条完整报价。
   * 选取规则与 getTldsWithMinPrice 完全一致（同一 effective 表达式、同样排除 < $1 的非促销占位价）。
   */
  export async function getTldBestQuotes(): Promise<TldBestQuote[]> {
  const base = await getTldsWithMinPrice()
  const fallback = base.map((t) => ({
  tld: t.tld,
  type: t.type,
  isPopular: t.isPopular,
  registrarCount: Number(t.registrarCount),
  registrarSlug: null,
  registrarName: null,
  currency: t.minRegister != null ? "USD" : null,
  registerPrice: t.minRegister != null ? String(t.minRegister) : null,
  renewPrice: null,
  promotionPrice: null,
  promotionEndsAt: null,
  promoCode: null,
  sourceUrl: null,
  }))
  return safeQuery(
  "getTldBestQuotes",
  async () => {
  const hasActivePromotion = sql<boolean>`(
  ${prices.promotionPrice} IS NOT NULL
  AND (${prices.promotionEndsAt} IS NULL OR ${prices.promotionEndsAt} >= now())
  AND ${prices.registerPrice} IS NOT NULL
  AND ${prices.promotionPrice} > 0 AND ${prices.promotionPrice} < ${prices.registerPrice})`
  const effective = sql<string>`CASE WHEN ${hasActivePromotion} THEN ${prices.promotionPrice} ELSE ${prices.registerPrice} END`
  const usd = await usdEquivalentExpr(effective)
  const best = await db
  .selectDistinctOn([prices.tldId], {
  tldId: prices.tldId,
  registrarSlug: registrars.slug,
  registrarName: registrars.name,
  currency: prices.currency,
  registerPrice: prices.registerPrice,
  renewPrice: prices.renewPrice,
  promotionPrice: prices.promotionPrice,
  promotionEndsAt: prices.promotionEndsAt,
  promoCode: prices.promoCode,
  sourceUrl: prices.sourceUrl,
  })
  .from(prices)
  .innerJoin(registrars, and(eq(registrars.id, prices.registrarId), eq(registrars.isActive, true)))
  .where(sql`${usd} IS NOT NULL AND ${notPlaceholder(prices.registerPrice)} AND (${usd} >= 1 OR ${hasActivePromotion})`)
  .orderBy(prices.tldId, asc(usd))
  const byId = new Map(best.map((b) => [b.tldId, b]))
  return base.map((t, i) => {
  const b = byId.get(t.id)
  if (!b) return fallback[i]
  return {
  ...fallback[i],
  registrarSlug: b.registrarSlug,
  registrarName: b.registrarName,
  currency: b.currency,
  registerPrice: b.registerPrice,
  renewPrice: b.renewPrice,
  promotionPrice: b.promotionPrice,
  promotionEndsAt: b.promotionEndsAt ? new Date(b.promotionEndsAt).toISOString() : null,
  promoCode: b.promoCode,
  sourceUrl: b.sourceUrl,
  }
  })
  },
  fallback,
  )
  }

  /**
   * 新顶级（newG）申请列表：来自 ICANN 申请数据（sync-new-gtlds 维护），
   * 为尚未开放注册的后缀，含申请机构、状态、预计开放日期与来源链接。
   */
  export type UpcomingTld = {
    tld: string
    launchStatus: string | null
    launchDate: string | null
    launchType: string | null
    applicant: string | null
    sourceUrl: string | null
  }

  export async function getUpcomingGtlds(): Promise<UpcomingTld[]> {
    return safeQuery(
      "getUpcomingGtlds",
      async () => {
        const rows = await db
          .select({
            tld: tlds.tld,
            launchStatus: tlds.launchStatus,
            launchDate: tlds.launchDate,
            launchType: tlds.launchType,
            applicant: tlds.applicant,
            sourceUrl: tlds.sourceUrl,
          })
          .from(tlds)
          .where(and(eq(tlds.isValid, true), eq(tlds.type, "newG")))
          .orderBy(asc(tlds.tld))
        return rows.map((r) => ({
          ...r,
          launchDate: r.launchDate ? new Date(r.launchDate).toISOString() : null,
        }))
      },
      [],
    )
  }

/** 启用的注册商列表 + 支持后缀数 + 推荐分（覆盖/促销/完整度/能力/健康加权） */
export type ActiveRegistrarRow = {
  id: number
  slug: string
  name: string
  website: string
  description: string
  icannAccredited: boolean
  whoisPrivacy: boolean
  dnssec: boolean
  tldCount: number
  promoCount: number
  completeCount: number
  score: number
  scoreBreakdown: RegistrarScoreBreakdown
}

function healthScoreOf(health: unknown): number | null {
  if (health == null || typeof health !== "object") return null
  const score = (health as { score?: unknown }).score
  return typeof score === "number" && Number.isFinite(score) ? score : null
}

export async function getActiveRegistrars(): Promise<ActiveRegistrarRow[]> {
  return safeQuery(
    "getActiveRegistrars",
    async () => {
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
          paymentMethods: registrars.paymentMethods,
          health: registrars.health,
          tldCount: count(prices.id),
          promoCount: sql<number>`count(${prices.promotionPrice})`.mapWith(Number),
          completeCount:
            sql<number>`count(*) filter (where ${prices.registerPrice} is not null and ${prices.renewPrice} is not null)`.mapWith(
              Number,
            ),
        })
        .from(registrars)
        .leftJoin(prices, eq(prices.registrarId, registrars.id))
        .where(eq(registrars.isActive, true))
        .groupBy(registrars.id)

      const scored = rows.map((r) => {
        const { score, breakdown } = computeRegistrarScore({
          tldCount: r.tldCount,
          promoCount: r.promoCount,
          completeCount: r.completeCount,
          icannAccredited: r.icannAccredited,
          whoisPrivacy: r.whoisPrivacy,
          dnssec: r.dnssec,
          paymentMethodCount: Array.isArray(r.paymentMethods) ? r.paymentMethods.length : 0,
          healthScore: healthScoreOf(r.health),
        })
        return { ...r, score, scoreBreakdown: breakdown }
      })
      scored.sort((a, b) => b.score - a.score || b.tldCount - a.tldCount || a.name.localeCompare(b.name))
      return scored
    },
    seedActiveRegistrars(),
  )
}

/** 后缀详情：后缀信息 */
export async function getTldByName(tld: string) {
  return safeQuery(
    "getTldByName",
    async () => {
      const [row] = await db.select().from(tlds).where(eq(tlds.tld, tld.toLowerCase())).limit(1)
      return row ?? null
    },
    seedTldByName(tld),
  )
}

/** 某后缀下全部启用注册商的价格 */
export async function getPricesForTld(tldId: number) {
  return safeQuery(
    "getPricesForTld",
    async () => {
      const rows = await db
        .select({
          priceId: prices.id,
          registerPrice: prices.registerPrice,
          renewPrice: prices.renewPrice,
          transferPrice: prices.transferPrice,
          promotionPrice: prices.promotionPrice,
          promoCode: prices.promoCode,
          promoCodes: prices.promoCodes,
          promotionEndsAt: prices.promotionEndsAt,
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
    },
    seedPricesForTld(tldId),
  )
}

/** 注册商详情 */
export async function getRegistrarBySlug(slug: string) {
  return safeQuery(
    "getRegistrarBySlug",
    async () => {
      const [row] = await db.select().from(registrars).where(eq(registrars.slug, slug)).limit(1)
      return row ?? null
    },
    seedRegistrarBySlug(slug),
  )
}

/** 某注册商全部后缀价格 */
export async function getPricesForRegistrar(registrarId: number) {
  return safeQuery(
    "getPricesForRegistrar",
    async () => {
      const rows = await db
        .select({
          priceId: prices.id,
          registerPrice: prices.registerPrice,
          renewPrice: prices.renewPrice,
          transferPrice: prices.transferPrice,
          promotionPrice: prices.promotionPrice,
          promoCode: prices.promoCode,
          promoCodes: prices.promoCodes,
          promotionEndsAt: prices.promotionEndsAt,
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
      return rows.map((r) => ({
        ...r,
        promoCodes: (Array.isArray(r.promoCodes) ? r.promoCodes : null) as import("./seed-fallbacks").PromoCodesRow[] | null,
      }))
    },
    seedPricesForRegistrar(registrarId),
  )
}

/** 后缀的最近价格更新时间 */
export async function getTldLastUpdated(tldId: number) {
  return safeQuery(
    "getTldLastUpdated",
    async () => {
      const [row] = await db
        .select({ lastUpdated: max(prices.updatedAt) })
        .from(prices)
        .where(eq(prices.tldId, tldId))
      return row?.lastUpdated ?? null
    },
    seedTldLastUpdated(tldId),
  )
}

/** 最近成功的采集任务（供首页“数据更新”展示） */
export async function getRecentJobs(limit = 10) {
  return safeQuery(
    "getRecentJobs",
    async () => {
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
    },
    [],
  )
}
