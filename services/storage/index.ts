import "server-only"

import { db } from "@/lib/db"
import { crawlJobs, crawlLogs, priceHistory, prices, registrars, tlds } from "@/lib/db/schema"
import type { DomainPrice, JobStatus } from "@/lib/crawler/types"
import { and, eq } from "drizzle-orm"

/**
 * Storage 服务：采集结果的唯一落库入口
 *
 * 职责：写入/更新 prices、追加 price_history、跳过无变化价格、
 * 写 crawl_logs、维护 crawl_jobs 状态。Adapter 与 Runner 不直接操作这些表。
 */

/** 归一化价格数值（numeric 列以字符串比较），便于差异对比 */
const norm = (v: number | null | undefined): string | null =>
  v === null || v === undefined ? null : v.toFixed(2)

export interface SaveResult {
  /** 实际写入/更新的行数 */
  updated: number
  /** 无变化被跳过的行数 */
  skipped: number
  /** 数据源里存在但 tlds 表未收录的后缀数 */
  unknownTlds: number
}

export class StorageService {
  // ---------- 任务 ----------

  async createJob(registrarId: number, trigger = "manual") {
    const [job] = await db
      .insert(crawlJobs)
      .values({ registrarId, status: "pending", trigger })
      .returning()
    return job
  }

  async markJobRunning(jobId: number, startedAt: Date) {
    await db.update(crawlJobs).set({ status: "running", startedAt }).where(eq(crawlJobs.id, jobId))
  }

  async finishJob(
    jobId: number,
    patch: {
      status: JobStatus
      finishedAt: Date
      pricesUpdated?: number
      totalTlds?: number
      errorMessage?: string | null
    },
  ) {
    await db
      .update(crawlJobs)
      .set({
        status: patch.status,
        finishedAt: patch.finishedAt,
        pricesUpdated: patch.pricesUpdated ?? 0,
        totalTlds: patch.totalTlds ?? 0,
        errorMessage: patch.errorMessage ?? null,
      })
      .where(eq(crawlJobs.id, jobId))
  }

  async getJob(jobId: number) {
    const [job] = await db.select().from(crawlJobs).where(eq(crawlJobs.id, jobId))
    return job
  }

  /** 将进行中/待运行的任务标记为已取消，返回是否有任务被取消 */
  async cancelJob(jobId: number): Promise<boolean> {
    const job = await this.getJob(jobId)
    if (!job || (job.status !== "running" && job.status !== "pending")) return false
    await db
      .update(crawlJobs)
      .set({ status: "cancelled", finishedAt: new Date(), errorMessage: "已被手动取消" })
      .where(eq(crawlJobs.id, jobId))
    await this.writeLog(jobId, "warn", "任务被手动取消")
    return true
  }

  // ---------- 日志 ----------

  async writeLog(jobId: number, level: "info" | "warn" | "error", message: string) {
    await db.insert(crawlLogs).values({ jobId, level, message })
  }

  async getJobLogs(jobId: number) {
    return db.select().from(crawlLogs).where(eq(crawlLogs.jobId, jobId)).orderBy(crawlLogs.id)
  }

  // ---------- 注册商 ----------

  async getRegistrarBySlug(slug: string) {
    const [r] = await db.select().from(registrars).where(eq(registrars.slug, slug))
    return r
  }

  async getActiveRegistrars() {
    return db.select().from(registrars).where(eq(registrars.isActive, true))
  }

  // ---------- 价格（差异写入） ----------

  /**
   * 保存归一化价格：与现有 prices 逐条对比，
   * 仅在价格/币种变化时更新并追加 price_history；无变化跳过。
   */
  async savePrices(registrarId: number, items: DomainPrice[]): Promise<SaveResult> {
    const allTlds = await db.select({ id: tlds.id, tld: tlds.tld }).from(tlds)
    const tldMap = new Map(allTlds.map((t) => [t.tld, t.id]))
    const existing = await db.select().from(prices).where(eq(prices.registrarId, registrarId))
    const existingMap = new Map(existing.map((p) => [p.tldId, p]))

    let updated = 0
    let skipped = 0
    let unknownTlds = 0

    for (const item of items) {
      const tldId = tldMap.get(item.tld)
      if (!tldId) {
        unknownTlds++
        continue
      }

      const next = {
        registerPrice: norm(item.register_price),
        renewPrice: norm(item.renew_price),
        transferPrice: norm(item.transfer_price),
        currency: item.currency,
      }
      const prev = existingMap.get(tldId)

      if (
        prev &&
        prev.registerPrice === next.registerPrice &&
        prev.renewPrice === next.renewPrice &&
        prev.transferPrice === next.transferPrice &&
        prev.currency === next.currency
      ) {
        skipped++
        continue
      }

      if (prev) {
        await db
          .update(prices)
          .set({ ...next, sourceUrl: item.source, updatedAt: item.checked_at })
          .where(and(eq(prices.registrarId, registrarId), eq(prices.tldId, tldId)))
      } else {
        await db.insert(prices).values({
          registrarId,
          tldId,
          ...next,
          sourceUrl: item.source,
          updatedAt: item.checked_at,
        })
      }
      await db.insert(priceHistory).values({ registrarId, tldId, ...next })
      updated++
    }

    return { updated, skipped, unknownTlds }
  }
}

/** 默认单例（Runner 通过构造函数注入，可替换为测试替身） */
export const storageService = new StorageService()
