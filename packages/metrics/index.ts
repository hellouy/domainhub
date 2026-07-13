/**
 * Metrics 平台
 * ------------------------------------------------------------
 * 所有权: Platform Team
 *
 * 收集适配器运行的分阶段指标(发现/下载/解析/校验/入库/总耗时)
 * 与行级统计(rows/inserted/updated/skipped/rejected/retries/coverage)。
 *
 * MetricsCollector 是纯内存对象, 独立可测, 不依赖数据库。
 * 持久化由 services 层写入 crawl_jobs.metrics(jsonb)。
 */

export interface StageMetrics {
  discoveryMs: number
  downloadMs: number
  parsingMs: number
  validationMs: number
  databaseMs: number
  totalMs: number
  rows: number
  inserted: number
  updated: number
  skipped: number
  rejected: number
  retries: number
  /** 实际入库 TLD 数 / 目标 TLD 数, 0~1 */
  coverage: number
}

export type StageName = "discovery" | "download" | "parsing" | "validation" | "database"

export class MetricsCollector {
  private timers = new Map<string, number>()
  private stages: Partial<Record<StageName, number>> = {}
  private startedAt = Date.now()

  rows = 0
  inserted = 0
  updated = 0
  skipped = 0
  rejected = 0
  retries = 0
  coverage = 0

  /** 开始一个阶段计时 */
  startStage(stage: StageName) {
    this.timers.set(stage, Date.now())
  }

  /** 结束一个阶段计时(可多次调用同一阶段, 耗时累加) */
  endStage(stage: StageName) {
    const start = this.timers.get(stage)
    if (start === undefined) return
    this.stages[stage] = (this.stages[stage] ?? 0) + (Date.now() - start)
    this.timers.delete(stage)
  }

  /** 直接记录阶段耗时(毫秒) */
  recordStage(stage: StageName, ms: number) {
    this.stages[stage] = (this.stages[stage] ?? 0) + ms
  }

  addRetry() {
    this.retries += 1
  }

  /** 生成最终快照 */
  snapshot(): StageMetrics {
    return {
      discoveryMs: this.stages.discovery ?? 0,
      downloadMs: this.stages.download ?? 0,
      parsingMs: this.stages.parsing ?? 0,
      validationMs: this.stages.validation ?? 0,
      databaseMs: this.stages.database ?? 0,
      totalMs: Date.now() - this.startedAt,
      rows: this.rows,
      inserted: this.inserted,
      updated: this.updated,
      skipped: this.skipped,
      rejected: this.rejected,
      retries: this.retries,
      coverage: this.coverage,
    }
  }
}

/**
 * 健康评分计算
 * ------------------------------------------------------------
 * score = successRate * 0.5 + coverage * 0.3 + latencyScore * 0.2
 * latencyScore: <5s 满分, >60s 0 分, 线性衰减
 */
export interface HealthSnapshot {
  /** 0~100 */
  score: number
  /** 0~1 */
  coverage: number
  /** 0~1 */
  successRate: number
  /** 0~1 */
  failureRate: number
  avgLatencyMs: number
  lastSuccessAt: string | null
  lastFailureAt: string | null
  failureReason: string | null
  currentStrategy: string | null
}

export function computeHealthScore(input: {
  successRate: number
  coverage: number
  avgLatencyMs: number
}): number {
  const latencyScore =
    input.avgLatencyMs <= 5_000
      ? 1
      : input.avgLatencyMs >= 60_000
        ? 0
        : 1 - (input.avgLatencyMs - 5_000) / 55_000
  const score = input.successRate * 0.5 + input.coverage * 0.3 + latencyScore * 0.2
  return Math.round(score * 100)
}
