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

const num = (v: string | null): number | null => (v === null ? null : Number.parseFloat(v))

/** 价格列表(可按注册商/后缀过滤) */
export async function queryPrices(filter: { registrar?: string; tld?: string; limit?: number }) {
  const conditions = [eq(registrars.isActive, true)]
  if (filter.registrar) conditions.push(eq(registrars.slug, filter.registrar))
  if (filter.tld) conditions.push(eq(tlds.tld, filter.tld.toLowerCase().replace(/^\./, "")))

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
}

/** 价格历史(可按注册商/后缀/天数过滤) */
export async function queryHistory(filter: {
  registrar?: string
  tld?: string
  days?: number
  limit?: number
}) {
  const conditions = []
  if (filter.registrar) conditions.push(eq(registrars.slug, filter.registrar))
  if (filter.tld) conditions.push(eq(tlds.tld, filter.tld.toLowerCase().replace(/^\./, "")))
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
}

/** 注册商列表(含健康/能力/版本) */
export async function queryRegistrars() {
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
}

/** 平台统计 */
export async function queryStatistics() {
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
}

/** 各注册商健康快照 */
export async function queryHealth() {
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
}
