import "server-only"

import { db } from "@/lib/db"
import { metrics } from "@/lib/db/schema"
import { and, gte, sql } from "drizzle-orm"

/**
 * Metrics 服务：平台性能指标的唯一采集与查询入口（Sprint 4 Part 5）
 *
 * 指标命名约定（name 列）：
 * - crawler.duration       采集任务耗时（ms），context = registrar slug
 * - crawler.adapter_latency Adapter fetch+parse 耗时（ms），context = registrar slug
 * - db.write_duration      Storage 批量写入耗时（ms），context = registrar slug
 * - api.response_time      API 响应耗时（ms），context = 路由路径
 * - cache.hit_ratio        缓存命中率（%），context = ""
 * - crawler.daily_jobs     当日任务数（个）
 * - crawler.daily_rows     当日更新行数（行）
 *
 * 写入是尽力而为（fire-and-forget 容错）：指标失败绝不能影响业务流程。
 */

export type MetricName =
  | "crawler.duration"
  | "crawler.adapter_latency"
  | "db.write_duration"
  | "api.response_time"
  | "cache.hit_ratio"

export class MetricsService {
  /** 记录一个指标值。失败仅打日志，不抛错。 */
  async record(name: MetricName, value: number, unit = "ms", context = ""): Promise<void> {
    try {
      await db.insert(metrics).values({ name, value: value.toFixed(3), unit, context })
    } catch (err) {
      console.log("[v0] metrics record failed:", err instanceof Error ? err.message : err)
    }
  }

  /** 包裹一个异步操作并自动记录耗时 */
  async measure<T>(name: MetricName, context: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now()
    try {
      return await fn()
    } finally {
      void this.record(name, Date.now() - start, "ms", context)
    }
  }

  /** 指定指标最近 N 小时的聚合（平均/最大/次数） */
  async summarize(name: MetricName, hours = 24) {
    const since = new Date(Date.now() - hours * 3600 * 1000)
    const [row] = await db
      .select({
        avg: sql<string>`coalesce(round(avg(${metrics.value}), 1), 0)`,
        max: sql<string>`coalesce(max(${metrics.value}), 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(metrics)
      .where(and(sql`${metrics.name} = ${name}`, gte(metrics.recordedAt, since)))
    return { avg: Number(row?.avg ?? 0), max: Number(row?.max ?? 0), count: row?.count ?? 0 }
  }

  /** 按 context 分组的耗时概览（如各注册商的平均采集耗时） */
  async summarizeByContext(name: MetricName, hours = 24) {
    const since = new Date(Date.now() - hours * 3600 * 1000)
    return db
      .select({
        context: metrics.context,
        avg: sql<string>`round(avg(${metrics.value}), 1)`,
        max: sql<string>`max(${metrics.value})`,
        count: sql<number>`count(*)::int`,
      })
      .from(metrics)
      .where(and(sql`${metrics.name} = ${name}`, gte(metrics.recordedAt, since)))
      .groupBy(metrics.context)
      .orderBy(sql`avg(${metrics.value}) desc`)
  }
}

export const metricsService = new MetricsService()
