import "server-only"

import { getAdapter, listAdapters } from "@/lib/crawler/adapters"
import type {
  CrawlContext,
  CrawlJobResult,
  JobStatus,
  RegistrarAdapter,
  RunnerOptions,
} from "@/lib/crawler/types"
import { storageService, type StorageService } from "@/services/storage"

/**
 * CrawlerRunner —— 采集引擎调度器
 *
 * 职责：运行单个/全部 Adapter、失败重试（最多 3 次）、单次尝试超时（60s）、
 * 响应取消、记录日志、统计耗时与更新行数。
 * 依赖注入：Storage 服务与 Adapter 列表均可在构造时替换（便于测试）。
 */

const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_TIMEOUT_MS = 60_000

/** 进程内取消标记（同一实例内的"停止"按钮即时生效；跨实例以 DB 状态为准） */
const cancelledJobs = new Set<number>()

/** 用超时包裹一个 Promise */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}超时（${ms / 1000}s）`)), ms)
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

export class CrawlerRunner {
  constructor(
    private readonly storage: StorageService = storageService,
    private readonly options: Required<RunnerOptions> = {
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
  ) {}

  /** 可用的全部 Adapter（后台展示用） */
  listAdapters(): RegistrarAdapter[] {
    return listAdapters()
  }

  /** 请求停止一个进行中的任务 */
  async stop(jobId: number): Promise<boolean> {
    cancelledJobs.add(jobId)
    return this.storage.cancelJob(jobId)
  }

  /** 运行全部启用的注册商（串行，避免打爆数据源与数据库连接） */
  async runAll(trigger = "manual"): Promise<CrawlJobResult[]> {
    const active = await this.storage.getActiveRegistrars()
    const results: CrawlJobResult[] = []
    for (const registrar of active) {
      results.push(await this.runBySlug(registrar.slug, trigger))
    }
    return results
  }

  /** 按注册商 slug 运行一次采集 */
  async runBySlug(slug: string, trigger = "manual"): Promise<CrawlJobResult> {
    const registrar = await this.storage.getRegistrarBySlug(slug)
    if (!registrar) {
      return this.immediateFailure(slug, "注册商不存在")
    }
    const adapter = getAdapter(slug)
    if (!adapter) {
      return this.immediateFailure(slug, `未注册 ${slug} 的采集 Adapter`)
    }

    const job = await this.storage.createJob(registrar.id, trigger)
    const startedAt = new Date()
    await this.storage.markJobRunning(job.id, startedAt)

    const ctx: CrawlContext = {
      jobId: job.id,
      log: (level, message) => this.storage.writeLog(job.id, level, message),
      isCancelled: () => cancelledJobs.has(job.id),
    }

    await ctx.log("info", `采集策略：${adapter.strategy}（最多 ${this.options.maxAttempts} 次尝试，单次超时 ${this.options.timeoutMs / 1000}s）`)

    let lastError = "未知错误"
    let attempts = 0

    for (attempts = 1; attempts <= this.options.maxAttempts; attempts++) {
      if (await this.checkCancelled(job.id, ctx, startedAt, slug, attempts)) {
        return this.buildResult(job.id, slug, "cancelled", "任务已取消", 0, 0, 0, attempts, startedAt)
      }
      try {
        // Adapter 生命周期：initialize -> fetch -> parse -> normalize -> finish
        const domainPrices = await withTimeout(
          adapter.collect(ctx),
          this.options.timeoutMs,
          `第 ${attempts} 次尝试`,
        )

        if (await this.checkCancelled(job.id, ctx, startedAt, slug, attempts)) {
          return this.buildResult(job.id, slug, "cancelled", "任务已取消", domainPrices.length, 0, 0, attempts, startedAt)
        }

        // save：由 Storage 服务差异写入
        const saved = await this.storage.savePrices(registrar.id, domainPrices)
        if (saved.unknownTlds > 0) {
          await ctx.log("info", `数据源含 ${saved.unknownTlds} 个未收录后缀，已跳过（可在 tlds 表中添加后自动收录）`)
        }

        const finishedAt = new Date()
        const durationMs = finishedAt.getTime() - startedAt.getTime()
        await this.storage.finishJob(job.id, {
          status: "success",
          finishedAt,
          pricesUpdated: saved.updated,
          totalTlds: domainPrices.length,
        })
        await ctx.log(
          "info",
          `任务完成：共 ${domainPrices.length} 条价格，更新 ${saved.updated} 条，无变化跳过 ${saved.skipped} 条，耗时 ${(durationMs / 1000).toFixed(1)}s`,
        )
        cancelledJobs.delete(job.id)
        return this.buildResult(
          job.id, slug, "success",
          `成功：更新 ${saved.updated} 条，跳过 ${saved.skipped} 条`,
          domainPrices.length, saved.updated, saved.skipped, attempts, startedAt,
        )
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
        await ctx.log(
          attempts < this.options.maxAttempts ? "warn" : "error",
          `第 ${attempts}/${this.options.maxAttempts} 次尝试失败：${lastError}`,
        )
        if (attempts < this.options.maxAttempts) {
          await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempts - 1)))
        }
      }
    }

    // 全部尝试失败：不写入任何价格，保留旧数据
    const finishedAt = new Date()
    await this.storage.finishJob(job.id, { status: "failed", finishedAt, errorMessage: lastError })
    await ctx.log("error", `任务失败（旧价格未被覆盖）：${lastError}`)
    cancelledJobs.delete(job.id)
    return this.buildResult(job.id, slug, "failed", lastError, 0, 0, 0, this.options.maxAttempts, startedAt, lastError)
  }

  /** 重试一个失败/取消的历史任务（按其注册商重新运行） */
  async retryJob(jobId: number): Promise<CrawlJobResult> {
    const job = await this.storage.getJob(jobId)
    if (!job) return this.immediateFailure("unknown", "任务不存在")
    if (job.status === "running" || job.status === "pending") {
      return this.immediateFailure("unknown", "任务仍在进行中，无法重试")
    }
    const registrars = await this.storage.getActiveRegistrars()
    const registrar = registrars.find((r) => r.id === job.registrarId)
    if (!registrar) return this.immediateFailure("unknown", "对应注册商不存在或已停用")
    return this.runBySlug(registrar.slug, "retry")
  }

  // ---------- 内部工具 ----------

  private async checkCancelled(
    jobId: number,
    ctx: CrawlContext,
    startedAt: Date,
    _slug: string,
    _attempts: number,
  ): Promise<boolean> {
    if (!ctx.isCancelled()) {
      // 跨实例场景：DB 中被标记 cancelled 时也应停止
      const job = await this.storage.getJob(jobId)
      if (job?.status === "cancelled") cancelledJobs.add(jobId)
    }
    if (ctx.isCancelled()) {
      const job = await this.storage.getJob(jobId)
      if (job && job.status !== "cancelled") {
        await this.storage.finishJob(jobId, {
          status: "cancelled",
          finishedAt: new Date(),
          errorMessage: "已被手动取消",
        })
      }
      cancelledJobs.delete(jobId)
      return true
    }
    return false
  }

  private buildResult(
    jobId: number,
    registrarSlug: string,
    status: JobStatus,
    message: string,
    totalTlds: number,
    updated: number,
    skipped: number,
    attempts: number,
    startedAt: Date,
    error?: string,
  ): CrawlJobResult {
    return {
      jobId,
      registrarSlug,
      status,
      ok: status === "success",
      message,
      totalTlds,
      updated,
      skipped,
      attempts,
      durationMs: Date.now() - startedAt.getTime(),
      error,
    }
  }

  private immediateFailure(slug: string, message: string): CrawlJobResult {
    return {
      jobId: 0,
      registrarSlug: slug,
      status: "failed",
      ok: false,
      message,
      totalTlds: 0,
      updated: 0,
      skipped: 0,
      attempts: 0,
      durationMs: 0,
      error: message,
    }
  }
}

/** 默认单例 Runner */
export const crawlerRunner = new CrawlerRunner()
