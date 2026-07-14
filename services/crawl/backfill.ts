/**
 * Backfill Service —— 分批全量回填编排
 * ------------------------------------------------------------
 * 所有权: Platform Team
 * 文档: docs/architecture.md(Services 章节)
 *
 * 职责: 对“逐 TLD 拉取”型注册商(如 Netim)按 IANA 有效后缀分批全量回填。
 * 单次 serverless 调用只跑“一批”(默认 50 个后缀)，进度游标持久化在
 * crawl_backfill 表；由 cron 每 5 分钟推进下一批，直到采完自动 completed。
 *
 * 设计要点:
 * - 跨调用游标: cron 无状态，进度全靠 crawl_backfill.cursor
 * - 间隔保护: 距上批不足 MIN_INTERVAL_MS 则本次 tick 跳过(防重入/超频)
 * - 有效后缀快照: 启动时记录 total，批次按 isValid 排序集切片
 * - 幂等: 每批调用既有 runCrawlWithSdk(带 tldScope.tlds 白名单)
 */

import { asc, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { crawlBackfill, tlds } from "@/lib/db/schema"
import { runCrawlWithSdk } from "./index"

/** 批次间最小间隔(略小于 5 分钟，容忍 cron 抖动) */
export const MIN_INTERVAL_MS = 4.5 * 60_000

/** 取某注册商“IANA 有效后缀”的热度降序名单(与 storage 排序一致) */
async function getValidRankedTlds(): Promise<string[]> {
  const rows = await db
    .select({ tld: tlds.tld })
    .from(tlds)
    .where(eq(tlds.isValid, true))
    .orderBy(desc(tlds.popularity), desc(tlds.isPopular), asc(tlds.tld))
  return rows.map((r) => r.tld.replace(/^\./, "").toLowerCase())
}

/** 读取回填状态(无则返回 null) */
export async function getBackfillState(registrarId: number) {
  const [row] = await db
    .select()
    .from(crawlBackfill)
    .where(eq(crawlBackfill.registrarId, registrarId))
    .limit(1)
  return row ?? null
}

/**
 * 启动/重启一轮分批回填：游标归零，快照有效后缀总数，状态置 running。
 * 幂等：重复调用会重置为新一轮。
 */
export async function startBackfill(
  registrarId: number,
  batchSize = 50,
): Promise<{ total: number; batchSize: number }> {
  const valid = await getValidRankedTlds()
  const total = valid.length
  const now = new Date()
  await db
    .insert(crawlBackfill)
    .values({
      registrarId,
      status: "running",
      cursor: 0,
      batchSize,
      total,
      batchesDone: 0,
      pricesUpdated: 0,
      lastBatchAt: null,
      startedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: crawlBackfill.registrarId,
      set: {
        status: "running",
        cursor: 0,
        batchSize,
        total,
        batchesDone: 0,
        pricesUpdated: 0,
        lastBatchAt: null,
        startedAt: now,
        updatedAt: now,
      },
    })
  return { total, batchSize }
}

/** 停止回填(保留游标，可后续手动恢复为 running) */
export async function stopBackfill(registrarId: number): Promise<void> {
  await db
    .update(crawlBackfill)
    .set({ status: "stopped", updatedAt: new Date() })
    .where(eq(crawlBackfill.registrarId, registrarId))
}

export interface BatchOutcome {
  ran: boolean
  reason?: string
  registrarId: number
  batchTlds?: string[]
  updated?: number
  cursor?: number
  total?: number
  completed?: boolean
}

/**
 * 推进一批：由 cron 调用。
 * - 非 running 状态 → 跳过
 * - 距上批不足间隔 → 跳过(force=true 可绕过，用于手动“立即跑一批”)
 * - 否则取 [cursor, cursor+batchSize) 的有效后缀，采集写库，推进游标
 * - 游标到达 total → 置 completed
 */
export async function runNextBatch(
  registrarId: number,
  opts: { force?: boolean } = {},
): Promise<BatchOutcome> {
  const state = await getBackfillState(registrarId)
  if (!state) return { ran: false, reason: "未初始化回填", registrarId }
  if (state.status !== "running") return { ran: false, reason: `状态为 ${state.status}`, registrarId }

  if (!opts.force && state.lastBatchAt) {
    const elapsed = Date.now() - new Date(state.lastBatchAt).getTime()
    if (elapsed < MIN_INTERVAL_MS) {
      return { ran: false, reason: `距上批仅 ${(elapsed / 1000).toFixed(0)}s，未到间隔`, registrarId }
    }
  }

  const valid = await getValidRankedTlds()
  // total 以启动快照为准；若后缀集变化导致越界，按当前长度收敛
  const total = state.total > 0 ? state.total : valid.length
  const start = state.cursor
  if (start >= valid.length) {
    await db
      .update(crawlBackfill)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(crawlBackfill.registrarId, registrarId))
    return { ran: false, reason: "已到末尾，标记完成", registrarId, completed: true, cursor: start, total }
  }

  const batch = valid.slice(start, start + state.batchSize)
  const result = await runCrawlWithSdk(registrarId, {
    tldScope: { tlds: batch },
    trigger: "backfill",
  })

  const updated = result?.updated ?? 0
  const nextCursor = start + batch.length
  const completed = nextCursor >= valid.length
  await db
    .update(crawlBackfill)
    .set({
      cursor: nextCursor,
      batchesDone: state.batchesDone + 1,
      pricesUpdated: state.pricesUpdated + updated,
      lastBatchAt: new Date(),
      status: completed ? "completed" : "running",
      updatedAt: new Date(),
    })
    .where(eq(crawlBackfill.registrarId, registrarId))

  return {
    ran: true,
    registrarId,
    batchTlds: batch,
    updated,
    cursor: nextCursor,
    total: valid.length,
    completed,
  }
}

/** 找出所有处于 running 状态的回填(供 cron 遍历) */
export async function listRunningBackfills(): Promise<number[]> {
  const rows = await db
    .select({ registrarId: crawlBackfill.registrarId })
    .from(crawlBackfill)
    .where(eq(crawlBackfill.status, "running"))
  return rows.map((r) => r.registrarId)
}
