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

import { and, eq, lte, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { crawlJobs, crawlQueue, registrars } from "@/lib/db/schema"
import { getQueue, type QueueTrigger } from "@/packages/queue"

/** 入队频率窗口默认值(小时): 窗口内有成功记录的注册商跳过入队 */
const DEFAULT_FREQUENCY_WINDOW_HOURS = 6

/** 读取入队频率窗口(毫秒); 非法/缺失回退默认值, >=24h 时告警 */
export function getFrequencyWindowMs(): number {
  const raw = process.env.CRAWL_SCHEDULE_WINDOW_HOURS
  const hours = raw === undefined ? DEFAULT_FREQUENCY_WINDOW_HOURS : Number(raw)
  if (!Number.isFinite(hours) || hours <= 0) return DEFAULT_FREQUENCY_WINDOW_HOURS * 3_600_000
  if (hours >= 24) {
    console.warn(
      JSON.stringify({ event: "scheduleAll", warn: "频率窗口>=24h, 每日 cron 全量刷新语义受影响", hours }),
    )
  }
  return hours * 3_600_000
}

/**
 * 查询频率窗口内有成功 crawl_jobs 的注册商 id 集合。
 * 返回 null 表示查询失败, 调用方降级为全量入队(可用性优先)。
 */
async function fetchRecentSuccessRegistrarIds(windowMs: number): Promise<Set<number> | null> {
  const cutoff = new Date(Date.now() - windowMs)
  try {
    const rows = await db.execute(sql`
      SELECT DISTINCT registrar_id FROM crawl_jobs
      WHERE status = 'success' AND COALESCE(finished_at, created_at) >= ${cutoff}
    `)
    return new Set(rows.rows.map((r) => Number(r.registrar_id)))
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "scheduleAll",
        warn: "频率窗口查询失败, 降级为全量入队",
        error: error instanceof Error ? error.message : String(error),
      }),
    )
    return null
  }
}

/** 依据近期成功集合把注册商分为入队/跳过两组(纯函数, 便于测试) */
export function buildEnqueuePlan<T extends { id: number }>(
  active: T[],
  recentSuccessIds: Set<number> | null,
): { toEnqueue: T[]; skippedIds: number[] } {
  const toEnqueue: T[] = []
  const skippedIds: number[] = []
  for (const r of active) {
    if (recentSuccessIds !== null && recentSuccessIds.has(r.id)) skippedIds.push(r.id)
    else toEnqueue.push(r)
  }
  return { toEnqueue, skippedIds }
}

/** 将所有激活注册商入队, 频率窗口内成功的注册商跳过; 返回入队/跳过数量 */
export async function scheduleAll(
  trigger: QueueTrigger = "cron",
): Promise<{ enqueued: number; skipped: number }> {
  const queue = getQueue()
  const active = await db
    .select({ id: registrars.id, priority: registrars.priority })
    .from(registrars)
    .where(eq(registrars.isActive, true))

  const windowMs = getFrequencyWindowMs()
  const recentSuccessIds = await fetchRecentSuccessRegistrarIds(windowMs)
  const { toEnqueue, skippedIds } = buildEnqueuePlan(active, recentSuccessIds)

  for (const r of toEnqueue) {
    await queue.enqueue({
      registrarId: r.id,
      priority: r.priority ?? 100,
      trigger,
    })
  }
  console.log(
    JSON.stringify({
      event: "scheduleAll",
      trigger,
      enqueued: toEnqueue.length,
      skipped: skippedIds.length,
      windowHours: Math.round(windowMs / 3_600_000),
    }),
  )
  return { enqueued: toEnqueue.length, skipped: skippedIds.length }
}

/**
 * 恢复卡死的 running 队列项: serverless 执行中途崩溃会留下永久 running 项。
 * 超过 staleAfterMs 的 running 项重置为 retrying(按 attempts 退避)或 pending。
 * 同时回收 crawl_jobs 中卡死的 running 记录, 避免监控面板永久显示"运行中"。
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

  // crawl_jobs 僵尸清理: 进程中途崩溃会留下永久 running 的任务记录,
  // 只清队列会让监控面板一直显示"运行中", 这里一并标记为 failed。
  const staleJobs = await db
    .update(crawlJobs)
    .set({
      status: "failed",
      errorMessage: "卡死超时自动回收",
      finishedAt: new Date(),
    })
    .where(
      and(eq(crawlJobs.status, "running"), lte(crawlJobs.startedAt, new Date(Date.now() - staleAfterMs))),
    )
    .returning({ id: crawlJobs.id })

  return stale.length + staleJobs.length
}

/** 单任务超时上限: 防止个别适配器挂死吃光整轮预算(合法慢任务如 playwright 渲染可达 150s+, 取 240s) */
const JOB_TIMEOUT_MS = 240_000
/** 启动新任务所需的最小剩余预算 */
const MIN_JOB_BUDGET_MS = 15_000

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

  // 先恢复卡死项(serverless 冻结/崩溃残留的 running), 再开始取任务; 恢复本身不占任务预算
  await recoverStaleRunning()

  while (processed < maxJobs && Date.now() - startedAt < budgetMs) {
    // 剩余预算不足时不再开工, 避免新任务中途被 serverless 超时强杀
    if (budgetMs - (Date.now() - startedAt) < MIN_JOB_BUDGET_MS) break
    const item = await queue.dequeue(
      options?.targetRegistrarId ? { registrarId: options.targetRegistrarId } : undefined,
    )
    if (!item) break
    processed++
    try {
      const result = await withJobTimeout(
        runJob(item.registrarId),
        Math.min(JOB_TIMEOUT_MS, budgetMs - (Date.now() - startedAt)),
      )
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

/** 给 Promise 加超时; 超时后拒绝, 原任务继续在后台跑(由 recoverStaleRunning 回收) */
function withJobTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`任务超时(${Math.round(ms / 1000)}s)`)), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}
