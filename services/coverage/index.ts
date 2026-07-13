import "server-only"

import { db } from "@/lib/db"
import { crawlJobs, prices, registrars, tlds } from "@/lib/db/schema"
import { desc, sql } from "drizzle-orm"
import { registrarRegistry } from "@/lib/crawler/registry"
import { cacheService, CACHE_TAGS, TTL } from "@/services/cache"
import { computeHealthScore } from "./health-score"

/**
 * Coverage 服务（Sprint 4 Part 1）：平台数据覆盖率的唯一计算入口
 *
 * 覆盖率定义：
 * - 平台覆盖率 = 价格行数 / (TLD 总数 × 注册商总数)
 * - 单注册商覆盖率 = 该注册商价格行数 / TLD 总数
 * - 单 TLD 覆盖率 = 有该 TLD 价格的注册商数 / 注册商总数
 */

export interface RegistrarCoverage {
  id: number
  slug: string
  name: string
  isActive: boolean
  /** 数据源类型（来自 RegistrarRegistry；无 Adapter 时为 null） */
  sourceType: string | null
  priceCount: number
  coveragePct: number
  missingRegister: number
  missingRenew: number
  missingTransfer: number
  lastCrawlAt: Date | null
  lastCrawlStatus: string | null
  /** 0-100 健康分 */
  healthScore: number
}

export interface TldCoverage {
  tld: string
  type: string
  registrarCount: number
  coveragePct: number
  minRegister: string | null
  maxRegister: string | null
}

export interface CoverageReport {
  totals: {
    registrars: number
    realRegistrars: number
    seedRegistrars: number
    totalTlds: number
    totalPrices: number
    coveragePct: number
    missingRegister: number
    missingRenew: number
    missingTransfer: number
    lastCrawlAt: Date | null
  }
  perRegistrar: RegistrarCoverage[]
  perTld: TldCoverage[]
}

export class CoverageService {
  /** 完整覆盖率报告（带缓存，采集成功后自动失效） */
  async getReport(): Promise<CoverageReport> {
    return cacheService.getOrSet("coverage:report", TTL.stats, () => this.computeReport(), [CACHE_TAGS.coverage])
  }

  private async computeReport(): Promise<CoverageReport> {
    const [allRegistrars, [tldCountRow], priceStats, tldStats, jobs] = await Promise.all([
      db.select().from(registrars).orderBy(registrars.name),
      db.select({ count: sql<number>`count(*)::int` }).from(tlds),
      // 每注册商：价格行数与缺失统计
      db
        .select({
          registrarId: prices.registrarId,
          count: sql<number>`count(*)::int`,
          missingRegister: sql<number>`count(*) filter (where ${prices.registerPrice} is null)::int`,
          missingRenew: sql<number>`count(*) filter (where ${prices.renewPrice} is null)::int`,
          missingTransfer: sql<number>`count(*) filter (where ${prices.transferPrice} is null)::int`,
        })
        .from(prices)
        .groupBy(prices.registrarId),
      // 每 TLD：覆盖注册商数与价格区间
      db
        .select({
          tld: tlds.tld,
          type: tlds.type,
          registrarCount: sql<number>`count(${prices.id})::int`,
          minRegister: sql<string | null>`min(${prices.registerPrice})`,
          maxRegister: sql<string | null>`max(${prices.registerPrice})`,
        })
        .from(tlds)
        .leftJoin(prices, sql`${prices.tldId} = ${tlds.id}`)
        .groupBy(tlds.id, tlds.tld, tlds.type)
        .orderBy(tlds.tld),
      // 每注册商最近一次任务
      db
        .select({
          registrarId: crawlJobs.registrarId,
          status: crawlJobs.status,
          createdAt: crawlJobs.createdAt,
        })
        .from(crawlJobs)
        .orderBy(desc(crawlJobs.id)),
    ])

    const tldCount = tldCountRow?.count ?? 0
    const priceMap = new Map(priceStats.map((p) => [p.registrarId, p]))
    const latestJob = new Map<number, { status: string; createdAt: Date }>()
    for (const job of jobs) {
      if (!latestJob.has(job.registrarId)) {
        latestJob.set(job.registrarId, { status: job.status, createdAt: job.createdAt })
      }
    }

    const perRegistrar: RegistrarCoverage[] = allRegistrars.map((r) => {
      const stat = priceMap.get(r.id)
      const job = latestJob.get(r.id) ?? null
      const registration = registrarRegistry.getRegistration(r.slug)
      const coveragePct = tldCount > 0 ? Math.round(((stat?.count ?? 0) / tldCount) * 100) : 0
      return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        isActive: r.isActive,
        sourceType: registration?.metadata.sourceType ?? null,
        priceCount: stat?.count ?? 0,
        coveragePct,
        missingRegister: stat?.missingRegister ?? 0,
        missingRenew: stat?.missingRenew ?? 0,
        missingTransfer: stat?.missingTransfer ?? 0,
        lastCrawlAt: job?.createdAt ?? null,
        lastCrawlStatus: job?.status ?? null,
        healthScore: computeHealthScore({
          coveragePct,
          lastCrawlStatus: job?.status ?? null,
          lastCrawlAt: job?.createdAt ?? null,
          missingRatio: stat && stat.count > 0 ? stat.missingRegister / stat.count : 0,
        }),
      }
    })

    const perTld: TldCoverage[] = tldStats.map((t) => ({
      tld: t.tld,
      type: t.type,
      registrarCount: t.registrarCount,
      coveragePct: allRegistrars.length > 0 ? Math.round((t.registrarCount / allRegistrars.length) * 100) : 0,
      minRegister: t.minRegister,
      maxRegister: t.maxRegister,
    }))

    const totalPrices = priceStats.reduce((acc, p) => acc + p.count, 0)
    // 真实/种子 Adapter 统计来自 RegistrarRegistry
    const realSlugs = new Set(
      registrarRegistry
        .listRegistrations()
        .filter((r) => r.metadata.sourceType !== "seed")
        .map((r) => r.adapter.slug),
    )
    const realCount = allRegistrars.filter((r) => realSlugs.has(r.slug)).length

    return {
      totals: {
        registrars: allRegistrars.length,
        realRegistrars: realCount,
        seedRegistrars: allRegistrars.length - realCount,
        totalTlds: tldCount,
        totalPrices,
        coveragePct:
          tldCount > 0 && allRegistrars.length > 0
            ? Math.round((totalPrices / (tldCount * allRegistrars.length)) * 100)
            : 0,
        missingRegister: priceStats.reduce((acc, p) => acc + p.missingRegister, 0),
        missingRenew: priceStats.reduce((acc, p) => acc + p.missingRenew, 0),
        missingTransfer: priceStats.reduce((acc, p) => acc + p.missingTransfer, 0),
        lastCrawlAt:
          [...latestJob.values()].map((j) => j.createdAt).sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
      },
      perRegistrar,
      perTld,
    }
  }
}

export const coverageService = new CoverageService()
