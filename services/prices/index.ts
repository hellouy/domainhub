/**
 * Prices Service —— 价格/历史/统计/健康查询服务
 * ------------------------------------------------------------
 * 所有权: API Team
 * 文档: docs/api.md
 *
 * REST API v1 的业务查询层。路由处理器保持薄封装,
 * 所有查询逻辑集中在此, 不依赖 UI。
 */

import { and, desc, eq, gte, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  crawlJobs,
  priceHistory,
  prices,
  registrarCapabilities,
  registrars,
  tlds,
} from "@/lib/db/schema"
import {
  seedActiveRegistrars,
  seedPricesForTld,
  seedRegistrarBySlug,
  seedStats,
  seedTldsWithMinPrice,
} from "@/lib/db/seed-fallbacks"

const num = (v: string | null): number | null => (v === null ? null : Number.parseFloat(v))

/**
 * 与 lib/db/queries.ts 的 safeQuery 同一策略:数据库不可用时回退到
 * seed 数据,保证 v1 API 在无 DB(演示/预览环境)下仍返回 200。
 */
async function withFallback<T>(label: string, run: () => Promise<T>, fallback: () => T): Promise<T> {
  try {
    return await run()
  } catch (err) {
    console.error(`[db] ${label} failed, returning fallback:`, err)
    return fallback()
  }
}

function normalizeTld(v: string): string {
  return v.toLowerCase().replace(/^\./, "")
}

/** 无 DB 时的价格列表:遍历 seed 后缀 × 各注册商明细,与 queryPrices 行结构对齐 */
function seedPricesRows(filter: { registrar?: string; tld?: string; limit?: number }) {
  const tldFilter = filter.tld ? normalizeTld(filter.tld) : undefined
  const rows: {
    registrar: string
    registrarName: string
    tld: string
    currency: string
    registerPrice: number | null
    renewPrice: number | null
    transferPrice: number | null
    sourceUrl: string | null
    updatedAt: Date
  }[] = []
  for (const t of seedTldsWithMinPrice()) {
    if (tldFilter && t.tld !== tldFilter) continue
    for (const p of seedPricesForTld(t.id)) {
      if (filter.registrar && p.registrarSlug !== filter.registrar) continue
      rows.push({
        registrar: p.registrarSlug,
        registrarName: p.registrarName,
        tld: t.tld,
        currency: p.currency,
        registerPrice: num(p.registerPrice),
        renewPrice: num(p.renewPrice),
        transferPrice: num(p.transferPrice),
        sourceUrl: p.sourceUrl,
        updatedAt: p.updatedAt,
      })
    }
  }
  rows.sort((a, b) => a.registrar.localeCompare(b.registrar) || a.tld.localeCompare(b.tld))
  return rows.slice(0, Math.min(filter.limit ?? 500, 2000))
}

/** 无 DB 时的注册商列表:seed 注册商 + 统计的 TLD 覆盖数 */
function seedRegistrarRows() {
  return seedActiveRegistrars().map((r) => {
    const full = seedRegistrarBySlug(r.slug)
    return {
      slug: r.slug,
      name: r.name,
      website: r.website,
      isActive: true,
      icannAccredited: full?.icannAccredited ?? true,
      health: full?.health ?? null,
      owner: full?.owner ?? null,
      adapterVersion: full?.adapterVersion ?? null,
      priority: full?.priority ?? null,
      capabilities: null,
      supportedTlds: r.tldCount,
    }
  })
}

/** 价格列表(可按注册商/后缀过滤) */
export async function queryPrices(filter: { registrar?: string; tld?: string; limit?: number }) {
  return withFallback(
    "queryPrices",
    async () => {
      const conditions = [eq(registrars.isActive, true)]
      if (filter.registrar) conditions.push(eq(registrars.slug, filter.registrar))
      if (filter.tld) conditions.push(eq(tlds.tld, normalizeTld(filter.tld)))

      const rows = await db
        .select({
          registrar: registrars.slug,
          registrarName: registrars.name,
          tld: tlds.tld,
          currency: prices.currency,
          registerPrice: prices.registerPrice,
          renewPrice: prices.renewPrice,
          transferPrice: prices.transferPrice,
          sourceUrl: prices.sourceUrl,
          updatedAt: prices.updatedAt,
        })
        .from(prices)
        .innerJoin(registrars, eq(prices.registrarId, registrars.id))
        .innerJoin(tlds, eq(prices.tldId, tlds.id))
        .where(and(...conditions))
        .orderBy(registrars.slug, tlds.tld)
        .limit(Math.min(filter.limit ?? 500, 2000))

      return rows.map((r) => ({
        ...r,
        registerPrice: num(r.registerPrice),
        renewPrice: num(r.renewPrice),
        transferPrice: num(r.transferPrice),
      }))
    },
    () => seedPricesRows(filter),
  )
}

/** 价格历史(可按注册商/后缀/天数过滤) */
export async function queryHistory(filter: {
  registrar?: string
  tld?: string
  days?: number
  limit?: number
}) {
  return withFallback(
    "queryHistory",
    async () => {
      const conditions = []
      if (filter.registrar) conditions.push(eq(registrars.slug, filter.registrar))
      if (filter.tld) conditions.push(eq(tlds.tld, normalizeTld(filter.tld)))
      if (filter.days) {
        conditions.push(gte(priceHistory.recordedAt, new Date(Date.now() - filter.days * 86_400_000)))
      }

      const rows = await db
        .select({
          registrar: registrars.slug,
          tld: tlds.tld,
          currency: priceHistory.currency,
          registerPrice: priceHistory.registerPrice,
          renewPrice: priceHistory.renewPrice,
          transferPrice: priceHistory.transferPrice,
          recordedAt: priceHistory.recordedAt,
        })
        .from(priceHistory)
        .innerJoin(registrars, eq(priceHistory.registrarId, registrars.id))
        .innerJoin(tlds, eq(priceHistory.tldId, tlds.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(priceHistory.id))
        .limit(Math.min(filter.limit ?? 500, 2000))

      return rows.map((r) => ({
        ...r,
        registerPrice: num(r.registerPrice),
        renewPrice: num(r.renewPrice),
        transferPrice: num(r.transferPrice),
      }))
    },
    () => [],
  )
}

/** 注册商列表(含健康/能力/版本) */
export async function queryRegistrars() {
  return withFallback(
    "queryRegistrars",
    async () => {
      const rows = await db
        .select({
          slug: registrars.slug,
          name: registrars.name,
          website: registrars.website,
          isActive: registrars.isActive,
          icannAccredited: registrars.icannAccredited,
          health: registrars.health,
          owner: registrars.owner,
          adapterVersion: registrars.adapterVersion,
          priority: registrars.priority,
          capabilities: registrarCapabilities.capabilities,
          supportedTlds: sql<number>`(SELECT count(*) FROM ${prices} WHERE ${prices.registrarId} = ${registrars.id})`,
        })
        .from(registrars)
        .leftJoin(registrarCapabilities, eq(registrarCapabilities.registrarId, registrars.id))
        .orderBy(registrars.slug)
      return rows
    },
    seedRegistrarRows,
  )
}

/** 平台统计 */
export async function queryStatistics() {
  return withFallback(
    "queryStatistics",
    async () => {
      const [row] = await db
        .select({
          registrarCount: sql<number>`(SELECT count(*) FROM ${registrars} WHERE ${registrars.isActive} = true)`,
          tldCount: sql<number>`(SELECT count(*) FROM ${tlds})`,
          priceCount: sql<number>`(SELECT count(*) FROM ${prices})`,
          historyCount: sql<number>`(SELECT count(*) FROM ${priceHistory})`,
          jobCount: sql<number>`(SELECT count(*) FROM ${crawlJobs})`,
          successJobs: sql<number>`(SELECT count(*) FROM ${crawlJobs} WHERE status = 'success')`,
          failedJobs: sql<number>`(SELECT count(*) FROM ${crawlJobs} WHERE status = 'failed')`,
          lastUpdated: sql<string | null>`(SELECT max(${prices.updatedAt}) FROM ${prices})`,
        })
        .from(sql`(SELECT 1) AS one`)
      return row
    },
    () => {
      const stats = seedStats()
      return {
        registrarCount: stats.registrarCount,
        tldCount: stats.tldCount,
        priceCount: stats.priceCount,
        historyCount: 0,
        jobCount: 0,
        successJobs: 0,
        failedJobs: 0,
        lastUpdated: stats.lastUpdated,
      }
    },
  )
}

/** 各注册商健康快照 */
export async function queryHealth() {
  return withFallback(
    "queryHealth",
    async () => {
      const rows = await db
        .select({
          slug: registrars.slug,
          name: registrars.name,
          isActive: registrars.isActive,
          health: registrars.health,
          adapterVersion: registrars.adapterVersion,
        })
        .from(registrars)
        .where(eq(registrars.isActive, true))
        .orderBy(registrars.slug)
      return rows
    },
    () =>
      seedActiveRegistrars().map((r) => ({
        slug: r.slug,
        name: r.name,
        isActive: true,
        health: null,
        adapterVersion: null,
      })),
  )
}
