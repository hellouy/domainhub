import "server-only"

import { db } from "@/lib/db"
import { crawlJobs, crawlLogs, priceHistory, prices, registrars, schedulerSettings, tlds } from "@/lib/db/schema"
import type { DomainPrice, JobStatus } from "@/lib/crawler/types"
import { and, desc, eq, inArray } from "drizzle-orm"

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
  /** 实际写入/更新的行数（inserted + changed） */
  updated: number
  /** 其中新插入的行数 */
  inserted: number
  /** 无变化被跳过的行数 */
  skipped: number
  /** 本次自动收录进 tlds 表的新后缀数 */
  newTlds: number
  /** 数据源里存在但 tlds 表未收录的后缀数（仅当禁用自动收录时非 0） */
  unknownTlds: number
}

/** 经典 gTLD 列表（其余非 2 字母后缀视为新顶级域名 newG） */
const CLASSIC_GTLDS = new Set(["com", "net", "org", "info", "biz", "name", "pro", "mobi", "asia", "tel"])

/** 根据后缀形态推断类型：2 字母 → ccTLD；经典列表 → gTLD；其余 → newG */
function inferTldType(tld: string): string {
  const last = tld.split(".").pop() ?? tld
  if (last.length === 2) return "ccTLD"
  if (CLASSIC_GTLDS.has(last)) return "gTLD"
  return "newG"
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
      retries?: number
      rowsInserted?: number
      rowsUpdated?: number
      rowsSkipped?: number
      rowsRejected?: number
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
        retries: patch.retries ?? 0,
        rowsInserted: patch.rowsInserted ?? 0,
        rowsUpdated: patch.rowsUpdated ?? 0,
        rowsSkipped: patch.rowsSkipped ?? 0,
        rowsRejected: patch.rowsRejected ?? 0,
        errorMessage: patch.errorMessage ?? null,
      })
      .where(eq(crawlJobs.id, jobId))
  }

  /** 每个注册商最近一次失败/取消的任务（供"重试失败"使用） */
  async getLatestFailedRegistrarIds(): Promise<number[]> {
    const recent = await db
      .select({
        registrarId: crawlJobs.registrarId,
        status: crawlJobs.status,
        id: crawlJobs.id,
      })
      .from(crawlJobs)
      .orderBy(desc(crawlJobs.id))
    const latestByRegistrar = new Map<number, string>()
    for (const job of recent) {
      if (!latestByRegistrar.has(job.registrarId)) {
        latestByRegistrar.set(job.registrarId, job.status)
      }
    }
    return [...latestByRegistrar.entries()]
      .filter(([, status]) => status === "failed" || status === "cancelled")
      .map(([registrarId]) => registrarId)
  }

  // ---------- 调度设置 ----------

  async getSchedulerSettings() {
    const [row] = await db.select().from(schedulerSettings).limit(1)
    return row
  }

  async updateSchedulerSettings(patch: { enabled?: boolean; runHourUtc?: number; lastRunAt?: Date }) {
    const current = await this.getSchedulerSettings()
    if (!current) return
    await db
      .update(schedulerSettings)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(schedulerSettings.id, current.id))
  }

  /** 按注册商 id 列表查 slug（重试失败场景） */
  async getRegistrarsByIds(ids: number[]) {
    if (ids.length === 0) return []
    return db.select().from(registrars).where(inArray(registrars.id, ids))
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

    // 自动收录：数据源中出现但 tlds 表未收录的后缀，先批量建档再写价格
    const missing = [...new Set(items.map((i) => i.tld))].filter((t) => !tldMap.has(t))
    let newTlds = 0
    const TLD_CHUNK = 200
    for (let i = 0; i < missing.length; i += TLD_CHUNK) {
      const batch = missing.slice(i, i + TLD_CHUNK).map((tld) => ({
        tld,
        type: inferTldType(tld),
        description: "",
        isPopular: false,
      }))
      const created = await db
        .insert(tlds)
        .values(batch)
        .onConflictDoNothing({ target: tlds.tld })
        .returning({ id: tlds.id, tld: tlds.tld })
      for (const row of created) {
        tldMap.set(row.tld, row.id)
        newTlds++
      }
    }
    // onConflictDoNothing 未返回的（并发下已被其他任务创建），补查一次
    const stillMissing = missing.filter((t) => !tldMap.has(t))
    if (stillMissing.length > 0) {
      const rows = await db
        .select({ id: tlds.id, tld: tlds.tld })
        .from(tlds)
        .where(inArray(tlds.tld, stillMissing))
      for (const row of rows) tldMap.set(row.tld, row.id)
    }

    const existing = await db.select().from(prices).where(eq(prices.registrarId, registrarId))
    const existingMap = new Map(existing.map((p) => [p.tldId, p]))

    // 第一遍：纯内存差异对比，把写操作分桶（避免逐条往返数据库）
    type PriceRow = {
      registrarId: number
      tldId: number
      registerPrice: string | null
      renewPrice: string | null
      transferPrice: string | null
      currency: string
      sourceUrl: string
      updatedAt: Date
    }
    const toInsert: PriceRow[] = []
    const toUpdate: PriceRow[] = []
    let skipped = 0
    let unknownTlds = 0

    for (const item of items) {
      const tldId = tldMap.get(item.tld)
      if (!tldId) {
        unknownTlds++
        continue
      }
      const next: PriceRow = {
        registrarId,
        tldId,
        registerPrice: norm(item.register_price),
        renewPrice: norm(item.renew_price),
        transferPrice: norm(item.transfer_price),
        currency: item.currency,
        sourceUrl: item.source,
        updatedAt: item.checked_at,
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
      if (prev) toUpdate.push(next)
      else toInsert.push(next)
    }

    // 第二遍：批量执行（插入按块批量、更新并行小批、历史一次性批量追加）
    const CHUNK = 200
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      await db.insert(prices).values(toInsert.slice(i, i + CHUNK))
    }
    const PARALLEL = 10
    for (let i = 0; i < toUpdate.length; i += PARALLEL) {
      await Promise.all(
        toUpdate.slice(i, i + PARALLEL).map((row) =>
          db
            .update(prices)
            .set({
              registerPrice: row.registerPrice,
              renewPrice: row.renewPrice,
              transferPrice: row.transferPrice,
              currency: row.currency,
              sourceUrl: row.sourceUrl,
              updatedAt: row.updatedAt,
            })
            .where(and(eq(prices.registrarId, registrarId), eq(prices.tldId, row.tldId))),
        ),
      )
    }
    const historyRows = [...toInsert, ...toUpdate].map((row) => ({
      registrarId,
      tldId: row.tldId,
      registerPrice: row.registerPrice,
      renewPrice: row.renewPrice,
      transferPrice: row.transferPrice,
      currency: row.currency,
    }))
    for (let i = 0; i < historyRows.length; i += CHUNK) {
      await db.insert(priceHistory).values(historyRows.slice(i, i + CHUNK))
    }

    return {
      updated: toInsert.length + toUpdate.length,
      inserted: toInsert.length,
      skipped,
      newTlds,
      unknownTlds,
    }
  }
}

/** 默认单例（Runner 通过构造函数注入，可替换为测试替身） */
export const storageService = new StorageService()
