/**
 * Scheduler 平台
 * ------------------------------------------------------------
 * 所有权: Platform Team
 *
 * 负责把"该采集哪些注册商"翻译成队列任务:
 * - scheduleAll(): 将所有激活注册商按优先级入队(cron 每日调用)
 * - drainQueue(): 从队列取任务并逐个执行(串行, 适合 serverless 时长限制)
 *
 * 只依赖 Queue 抽象与 services 层, 不依赖具体队列实现或 UI。
 */

import { and, eq, lte } from "drizzle-orm"
import { db } from "@/lib/db"
import { crawlQueue, registrars } from "@/lib/db/schema"
import { getQueue, type QueueTrigger } from "@/packages/queue"

/** 将所有激活注册商入队, 返回入队数量 */
export async function scheduleAll(trigger: QueueTrigger = "cron"): Promise<number> {
  const queue = getQueue()
  const active = await db
    .select({ id: registrars.id, priority: registrars.priority })
    .from(registrars)
    .where(eq(registrars.isActive, true))

  let count = 0
  for (const r of active) {
    await queue.enqueue({
      registrarId: r.id,
      priority: r.priority ?? 100,
      trigger,
    })
    count++
  }
  return count
}

/**
 * 恢复卡死的 running 队列项: serverless 执行中途崩溃会留下永久 running 项。
 * 超过 staleAfterMs 的 running 项重置为 retrying(按 attempts 退避)或 pending。
 */
export async function recoverStaleRunning(
  staleAfterMs = 30 * 60 * 1000,
): Promise<number> {
  const queue = getQueue()
  const stale = await db
    .select()
    .from(crawlQueue)
    .where(and(eq(crawlQueue.status, "running"), lte(crawlQueue.startedAt, new Date(Date.now() - staleAfterMs))))
  for (const item of stale) {
    if (item.attempts < item.maxAttempts) {
      const delayMs = 60_000 * 2 ** item.attempts
      await db
        .update(crawlQueue)
        .set({
          status: "retrying",
          lastError: "卡死超时恢复",
          scheduledAt: new Date(Date.now() + delayMs),
        })
        .where(eq(crawlQueue.id, item.id))
    } else {
      await db
        .update(crawlQueue)
        .set({ status: "failed", lastError: "卡死超时(超过最大尝试次数)", finishedAt: new Date() })
        .where(eq(crawlQueue.id, item.id))
    }
  }
  return stale.length
}

/**
 * 逐个取出并执行队列任务, 直到队列为空或达到 maxJobs/预算时间。
 * runJob 由调用方注入(services 层的 runCrawl), 保持本模块与业务解耦。
 * 执行前先恢复卡死的 running 项, 避免 serverless 崩溃残留阻塞队列。
 */
export async function drainQueue(
  runJob: (registrarId: number) => Promise<{ ok: boolean; error?: string }>,
  options?: { maxJobs?: number; budgetMs?: number; targetRegistrarId?: number },
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const queue = getQueue()
  const maxJobs = options?.maxJobs ?? 60
  const budgetMs = options?.budgetMs ?? 250_000
  const startedAt = Date.now()

  let processed = 0
  let succeeded = 0
  let failed = 0

  while (processed < maxJobs && Date.now() - startedAt < budgetMs) {
    // 先恢复卡死项, 再取任务(每轮最多恢复一次, 恢复本身不占任务预算)
    if (processed === 0) await recoverStaleRunning()
    const item = await queue.dequeue(
      options?.targetRegistrarId ? { registrarId: options.targetRegistrarId } : undefined,
    )
    if (!item) break
    processed++
    try {
      const result = await runJob(item.registrarId)
      if (result.ok) {
        await queue.complete(item.id)
        succeeded++
      } else {
        await queue.fail(item.id, result.error ?? "未知错误")
        failed++
      }
    } catch (error) {
      await queue.fail(item.id, error instanceof Error ? error.message : String(error))
      failed++
    }
  }

  return { processed, succeeded, failed }
}
