import { db } from "@/lib/db"
import { crawlJobs, crawlLogs, priceHistory, prices, registrars, tlds } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { getAdapter } from "./adapters"

/** 采集任务执行结果（供后台展示统计） */
export interface CrawlJobResult {
  jobId: number
  ok: boolean
  message: string
  /** 采集到的后缀总数（数据源覆盖数） */
  totalTlds: number
  /** 实际写入/更新的行数（价格有变化才计入） */
  updated: number
  /** 无变化被跳过的行数 */
  skipped: number
  /** 任务耗时（毫秒） */
  durationMs: number
  /** 失败时的错误信息 */
  error?: string
}

/** 归一化价格字符串（numeric 列），便于比较 */
const norm = (v: number | null | undefined): string | null =>
  v === null || v === undefined ? null : v.toFixed(2)

/**
 * 采集 Runner：对指定注册商执行一次采集任务
 *
 * 流程：创建 crawl_job -> 调用 Adapter -> 与现有价格逐条对比 ->
 * 仅在价格变化时更新 prices 并追加 price_history（无变化则跳过）->
 * 更新任务状态与统计。Adapter 抛错时不写入任何价格，保留旧数据。
 */
export async function runCrawlJob(registrarId: number): Promise<CrawlJobResult> {
  const startedAt = new Date()
  const fail = (jobId: number, message: string): CrawlJobResult => ({
    jobId,
    ok: false,
    message,
    totalTlds: 0,
    updated: 0,
    skipped: 0,
    durationMs: Date.now() - startedAt.getTime(),
    error: message,
  })

  const [registrar] = await db.select().from(registrars).where(eq(registrars.id, registrarId))
  if (!registrar) return fail(0, "注册商不存在")

  const [job] = await db
    .insert(crawlJobs)
    .values({ registrarId, status: "running", trigger: "manual", startedAt })
    .returning()

  const log = async (level: "info" | "warn" | "error", message: string) => {
    await db.insert(crawlLogs).values({ jobId: job.id, level, message })
  }

  try {
    const adapter = getAdapter(registrar.slug)
    if (!adapter) {
      throw new Error(`未注册 ${registrar.slug} 的采集 Adapter`)
    }
    await log("info", `采集策略：${adapter.strategy}`)

    const crawled = await adapter.fetchPrices({ log })

    // 构建 tld -> id 映射与现有价格映射（用于差异对比）
    const allTlds = await db.select().from(tlds)
    const tldMap = new Map(allTlds.map((t) => [t.tld, t.id]))
    const existing = await db.select().from(prices).where(eq(prices.registrarId, registrarId))
    const existingMap = new Map(existing.map((p) => [p.tldId, p]))

    let updated = 0
    let skipped = 0
    let unknown = 0

    for (const p of crawled) {
      const tldId = tldMap.get(p.tld)
      if (!tldId) {
        unknown++
        continue
      }

      const next = {
        registerPrice: norm(p.registerPrice),
        renewPrice: norm(p.renewPrice),
        transferPrice: norm(p.transferPrice),
        currency: p.currency,
      }
      const prev = existingMap.get(tldId)

      // 差异对比：价格与币种完全一致则跳过，不写 prices 也不写 history
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
          .set({ ...next, sourceUrl: p.sourceUrl ?? null, updatedAt: new Date() })
          .where(and(eq(prices.registrarId, registrarId), eq(prices.tldId, tldId)))
      } else {
        await db.insert(prices).values({
          registrarId,
          tldId,
          ...next,
          sourceUrl: p.sourceUrl ?? null,
          updatedAt: new Date(),
        })
      }
      await db.insert(priceHistory).values({ registrarId, tldId, ...next })
      updated++
    }

    if (unknown > 0) {
      await log("info", `数据源含 ${unknown} 个未收录后缀，已跳过（可在 tlds 表中添加后自动收录）`)
    }

    const finishedAt = new Date()
    const durationMs = finishedAt.getTime() - startedAt.getTime()
    await db
      .update(crawlJobs)
      .set({
        status: "success",
        finishedAt,
        pricesUpdated: updated,
        totalTlds: crawled.length,
      })
      .where(eq(crawlJobs.id, job.id))
    await log(
      "info",
      `任务完成：共 ${crawled.length} 条价格，更新 ${updated} 条，无变化跳过 ${skipped} 条，耗时 ${(durationMs / 1000).toFixed(1)}s`,
    )

    return {
      jobId: job.id,
      ok: true,
      message: `成功：更新 ${updated} 条，跳过 ${skipped} 条`,
      totalTlds: crawled.length,
      updated,
      skipped,
      durationMs,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const finishedAt = new Date()
    await db
      .update(crawlJobs)
      .set({ status: "failed", finishedAt, errorMessage: message })
      .where(eq(crawlJobs.id, job.id))
    await log("error", `任务失败（旧价格未被覆盖）：${message}`)
    return { ...fail(job.id, message), durationMs: finishedAt.getTime() - startedAt.getTime() }
  }
}

/** 某任务的日志 */
export async function getJobLogs(jobId: number) {
  return db.select().from(crawlLogs).where(eq(crawlLogs.jobId, jobId)).orderBy(crawlLogs.id)
}
