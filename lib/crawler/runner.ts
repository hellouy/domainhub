import { db } from "@/lib/db"
import { crawlJobs, crawlLogs, priceHistory, prices, registrars, tlds } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { getAdapter } from "./adapters"

/**
 * 采集 Runner：对指定注册商执行一次采集任务
 *
 * 流程：创建 crawl_job -> 调用 Adapter -> upsert prices ->
 * 追加 price_history -> 更新任务状态与统计。
 */
export async function runCrawlJob(registrarId: number): Promise<{ jobId: number; ok: boolean; message: string }> {
  const [registrar] = await db.select().from(registrars).where(eq(registrars.id, registrarId))
  if (!registrar) return { jobId: 0, ok: false, message: "注册商不存在" }

  const [job] = await db
    .insert(crawlJobs)
    .values({ registrarId, status: "running", trigger: "manual", startedAt: new Date() })
    .returning()

  const log = async (level: "info" | "warn" | "error", message: string) => {
    await db.insert(crawlLogs).values({ jobId: job.id, level, message })
  }

  try {
    const adapter = getAdapter(registrar.slug)
    if (!adapter) {
      throw new Error(`未注册 ${registrar.slug} 的采集 Adapter`)
    }

    const crawled = await adapter.fetchPrices({ log })

    // 构建 tld -> id 映射
    const allTlds = await db.select().from(tlds)
    const tldMap = new Map(allTlds.map((t) => [t.tld, t.id]))

    let updated = 0
    for (const p of crawled) {
      const tldId = tldMap.get(p.tld)
      if (!tldId) {
        await log("warn", `跳过未知后缀 .${p.tld}`)
        continue
      }
      const values = {
        registrarId,
        tldId,
        registerPrice: p.registerPrice?.toFixed(2) ?? null,
        renewPrice: p.renewPrice?.toFixed(2) ?? null,
        transferPrice: p.transferPrice?.toFixed(2) ?? null,
        currency: p.currency,
        sourceUrl: p.sourceUrl ?? null,
        updatedAt: new Date(),
      }
      await db
        .insert(prices)
        .values(values)
        .onConflictDoUpdate({
          target: [prices.registrarId, prices.tldId],
          set: {
            registerPrice: values.registerPrice,
            renewPrice: values.renewPrice,
            transferPrice: values.transferPrice,
            currency: values.currency,
            sourceUrl: values.sourceUrl,
            updatedAt: values.updatedAt,
          },
        })
      await db.insert(priceHistory).values({
        registrarId,
        tldId,
        registerPrice: values.registerPrice,
        renewPrice: values.renewPrice,
        transferPrice: values.transferPrice,
        currency: values.currency,
      })
      updated++
    }

    await db
      .update(crawlJobs)
      .set({ status: "success", finishedAt: new Date(), pricesUpdated: updated })
      .where(eq(crawlJobs.id, job.id))
    await log("info", `任务完成，更新 ${updated} 条价格`)

    return { jobId: job.id, ok: true, message: `成功更新 ${updated} 条价格` }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db
      .update(crawlJobs)
      .set({ status: "failed", finishedAt: new Date(), errorMessage: message })
      .where(eq(crawlJobs.id, job.id))
    await log("error", `任务失败：${message}`)
    return { jobId: job.id, ok: false, message }
  }
}

/** 最近任务列表（含注册商名称） */
export async function getRecentJobs(limit = 20) {
  return db
    .select({
      id: crawlJobs.id,
      status: crawlJobs.status,
      trigger: crawlJobs.trigger,
      startedAt: crawlJobs.startedAt,
      finishedAt: crawlJobs.finishedAt,
      pricesUpdated: crawlJobs.pricesUpdated,
      errorMessage: crawlJobs.errorMessage,
      createdAt: crawlJobs.createdAt,
      registrarName: registrars.name,
    })
    .from(crawlJobs)
    .leftJoin(registrars, eq(crawlJobs.registrarId, registrars.id))
    .orderBy(sql`${crawlJobs.createdAt} DESC`)
    .limit(limit)
}

/** 某任务的日志 */
export async function getJobLogs(jobId: number) {
  return db.select().from(crawlLogs).where(eq(crawlLogs.jobId, jobId)).orderBy(crawlLogs.id)
}
