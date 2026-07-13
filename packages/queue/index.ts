/**
 * Queue Platform —— 抽象队列接口 + 数据库实现
 *
 * 所有权：Platform Team
 * 文档：docs/architecture.md（Queue 章节）
 *
 * 业务逻辑只依赖 CrawlQueueService 接口；当前实现基于
 * crawl_queue 表（DbQueue）。未来可替换为 Redis / Upstash /
 * RabbitMQ / SQS 实现而不改动任何业务代码。
 */

import { and, asc, eq, inArray, lte, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { crawlQueue } from "@/lib/db/schema"

export type QueueTrigger = "manual" | "cron" | "api"

export interface EnqueueOptions {
  registrarId: number
  priority?: number
  trigger?: QueueTrigger
  maxAttempts?: number
  scheduledAt?: Date
}

export interface QueueItem {
  id: number
  registrarId: number
  status: string
  priority: number
  attempts: number
  maxAttempts: number
  trigger: string
  scheduledAt: Date
  lastError: string | null
  jobId: number | null
}

/** 抽象队列接口 —— 业务逻辑只允许依赖此接口 */
export interface CrawlQueueService {
  /** 入队（同一注册商已有 pending 任务时去重，返回已有项） */
  enqueue: (options: EnqueueOptions) => Promise<QueueItem>
  /** 取出下一个待执行项并标记为 running（按优先级 + 计划时间） */
  dequeue: () => Promise<QueueItem | null>
  /** 标记完成 */
  complete: (id: number, jobId?: number) => Promise<void>
  /** 标记失败：未达最大尝试次数则重新入队（retrying），否则终止（failed） */
  fail: (id: number, error: string) => Promise<void>
  /** 队列状态列表 */
  list: (limit?: number) => Promise<QueueItem[]>
  /** 待执行数量 */
  pendingCount: () => Promise<number>
}

const toItem = (row: typeof crawlQueue.$inferSelect): QueueItem => ({
  id: row.id,
  registrarId: row.registrarId,
  status: row.status,
  priority: row.priority,
  attempts: row.attempts,
  maxAttempts: row.maxAttempts,
  trigger: row.trigger,
  scheduledAt: row.scheduledAt,
  lastError: row.lastError,
  jobId: row.jobId,
})

/** 数据库队列实现（crawl_queue 表） */
export const dbQueue: CrawlQueueService = {
  async enqueue(options) {
    // 去重：同一注册商已有 pending/retrying 项时直接返回
    const [existing] = await db
      .select()
      .from(crawlQueue)
      .where(
        and(
          eq(crawlQueue.registrarId, options.registrarId),
          inArray(crawlQueue.status, ["pending", "retrying"]),
        ),
      )
      .limit(1)
    if (existing) return toItem(existing)

    const [row] = await db
      .insert(crawlQueue)
      .values({
        registrarId: options.registrarId,
        priority: options.priority ?? 100,
        trigger: options.trigger ?? "manual",
        maxAttempts: options.maxAttempts ?? 3,
        scheduledAt: options.scheduledAt ?? new Date(),
        status: "pending",
      })
      .returning()
    return toItem(row)
  },

  async dequeue() {
    // 原子领取：UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED)
    const rows = await db.execute(sql`
      UPDATE crawl_queue SET status = 'running', started_at = NOW(), attempts = attempts + 1
      WHERE id = (
        SELECT id FROM crawl_queue
        WHERE status IN ('pending', 'retrying') AND scheduled_at <= NOW()
        ORDER BY priority ASC, scheduled_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `)
    const list = rows.rows as unknown as Record<string, unknown>[]
    if (list.length === 0) return null
    const r = list[0]
    return {
      id: Number(r.id),
      registrarId: Number(r.registrar_id),
      status: String(r.status),
      priority: Number(r.priority),
      attempts: Number(r.attempts),
      maxAttempts: Number(r.max_attempts),
      trigger: String(r.trigger),
      scheduledAt: new Date(String(r.scheduled_at)),
      lastError: r.last_error ? String(r.last_error) : null,
      jobId: r.job_id ? Number(r.job_id) : null,
    }
  },

  async complete(id, jobId) {
    await db
      .update(crawlQueue)
      .set({ status: "completed", finishedAt: new Date(), jobId: jobId ?? null })
      .where(eq(crawlQueue.id, id))
  },

  async fail(id, error) {
    const [row] = await db.select().from(crawlQueue).where(eq(crawlQueue.id, id))
    if (!row) return
    if (row.attempts < row.maxAttempts) {
      // 重新入队：延后 2^attempts 分钟
      const delayMs = 60_000 * 2 ** row.attempts
      await db
        .update(crawlQueue)
        .set({
          status: "retrying",
          lastError: error,
          scheduledAt: new Date(Date.now() + delayMs),
        })
        .where(eq(crawlQueue.id, id))
    } else {
      await db
        .update(crawlQueue)
        .set({ status: "failed", lastError: error, finishedAt: new Date() })
        .where(eq(crawlQueue.id, id))
    }
  },

  async list(limit = 50) {
    const rows = await db
      .select()
      .from(crawlQueue)
      .orderBy(asc(crawlQueue.status), asc(crawlQueue.priority), asc(crawlQueue.scheduledAt))
      .limit(limit)
    return rows.map(toItem)
  },

  async pendingCount() {
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(crawlQueue)
      .where(
        and(
          inArray(crawlQueue.status, ["pending", "retrying"]),
          lte(crawlQueue.scheduledAt, new Date()),
        ),
      )
    return Number(rows[0]?.count ?? 0)
  },
}

/** 获取队列实现（未来按环境变量切换 Redis/SQS 等实现） */
export function getQueue(): CrawlQueueService {
  return dbQueue
}
