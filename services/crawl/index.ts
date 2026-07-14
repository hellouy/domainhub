/**
 * Crawl Service —— 采集业务服务
 * ------------------------------------------------------------
 * 所有权: Platform Team
 * 文档: docs/architecture.md(Services 章节)
 *
 * 职责: 把"对某注册商执行一次采集"编排为完整业务流程:
 * 创建 crawl_job → 构建 AdapterContext → 驱动 SDK 生命周期 →
 * 写入指标/策略/发现元数据/健康快照 → 返回统一结果。
 *
 * 业务规则:
 * - 新 SDK 适配器优先; 未迁移的注册商自动回退到旧 Adapter(lib/crawler)
 * - 适配器失败时不写入任何价格, 旧数据保留
 * - 本模块不依赖 UI, 不依赖具体队列实现
 */

import { desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  crawlJobs,
  crawlLogs,
  registrarCredentials,
  registrars,
} from "@/lib/db/schema"
import type {
  AdapterContext,
  CredentialType,
} from "@/packages/adapter-sdk"
import { rateLimitedFetch } from "@/packages/adapter-sdk"
import { resolveRenderer } from "@/packages/renderer"
import { decryptCredential } from "@/packages/credentials"
import { computeHealthScore, type HealthSnapshot } from "@/packages/metrics"
import {
  getRegisteredAdapter,
  saveDiscoveryMetadata,
  saveHealthSnapshot,
  syncAdapterToDb,
} from "@/packages/registry"
import { createPriceSink } from "@/packages/storage"
// 引入适配器包以触发自注册(唯一允许 import 适配器的位置)
import "@/adapters"

/** 采集结果(与旧 CrawlJobResult 向后兼容, 字段超集) */
export interface CrawlResult {
  jobId: number
  ok: boolean
  message: string
  totalTlds: number
  updated: number
  skipped: number
  durationMs: number
  error?: string
  /** 新增: 实际使用的策略 */
  strategy?: string | null
  /** 新增: 覆盖率 0~1 */
  coverage?: number
}

/** 采集选项(可选, 向后兼容) */
export interface CrawlOptions {
  /**
   * 后缀范围提示，注入 ctx.crawlScope，供“逐 TLD 拉取”型适配器(如 Netim)裁剪目标。
   * - tlds: 显式后缀白名单(分批回填每批走这里)
   * - topN: 只取热度前 N(日常默认由适配器决定)
   */
  tldScope?: { tlds?: string[]; topN?: number }
  /** crawl_jobs.trigger 值，默认 "manual"(cron/回填可传 "cron"/"backfill") */
  trigger?: string
}

/**
 * 对指定注册商执行一次采集(新 SDK 路径)。
 * 若该注册商没有注册新 SDK 适配器, 返回 null(调用方回退旧路径)。
 */
export async function runCrawlWithSdk(
  registrarId: number,
  options: CrawlOptions = {},
): Promise<CrawlResult | null> {
  const [registrar] = await db.select().from(registrars).where(eq(registrars.id, registrarId))
  if (!registrar) {
    return {
      jobId: 0, ok: false, message: "注册商不存在", totalTlds: 0,
      updated: 0, skipped: 0, durationMs: 0, error: "注册商不存在",
    }
  }

  const adapter = getRegisteredAdapter(registrar.slug)
  if (!adapter) return null

  const startedAt = new Date()
  const [job] = await db
    .insert(crawlJobs)
    .values({ registrarId, status: "running", trigger: options.trigger ?? "manual", startedAt })
    .returning()

  const log = async (level: "info" | "warn" | "error", message: string) => {
    await db.insert(crawlLogs).values({ jobId: job.id, level, message })
  }

  const { sink, knownTlds, knownTldsRanked, validTldsRanked } = await createPriceSink(registrarId)

  // 全量回填时优先用 IANA 有效后缀排序集，其它场景用全部排序集
  const rankedForCtx =
    options.tldScope?.tlds && options.tldScope.tlds.length > 0 ? validTldsRanked : knownTldsRanked

  const ctx: AdapterContext = {
    registrarId,
    slug: registrar.slug,
    log,
    fetch: (url, init) =>
      rateLimitedFetch(registrar.slug, url, init, adapter.definition.rateLimit, () => {
        retries++
      }),
    render: (url, renderOptions) => resolveRenderer().render(url, renderOptions),
    getCredential: (type?: CredentialType) => getCredentialForRegistrar(registrarId, type),
    knownTlds,
    knownTldsRanked: rankedForCtx,
    crawlScope: options.tldScope,
    addRetry: () => {
      retries++
    },
  }
  let retries = 0

  await log("info", `采集开始: 适配器 v${adapter.version}, SDK v${adapter.sdkVersion}, 策略优先级 [${adapter.strategyPriority.join(" → ")}]`)

  const result = await adapter.run(ctx, sink)
  result.metrics.retries += retries

  const finishedAt = new Date()
  const durationMs = finishedAt.getTime() - startedAt.getTime()

  if (result.ok) {
    await db
      .update(crawlJobs)
      .set({
        status: "success",
        finishedAt,
        pricesUpdated: result.metrics.inserted + result.metrics.updated,
        totalTlds: result.metrics.rows,
        strategy: result.strategy,
        metrics: result.metrics,
      })
      .where(eq(crawlJobs.id, job.id))
    await log(
      "info",
      `任务完成: 策略 ${result.strategy}, 共 ${result.metrics.rows} 条, 新增 ${result.metrics.inserted}, 更新 ${result.metrics.updated}, 跳过 ${result.metrics.skipped}, 拒绝 ${result.metrics.rejected}, 覆盖率 ${(result.metrics.coverage * 100).toFixed(0)}%, 耗时 ${(durationMs / 1000).toFixed(1)}s`,
    )
    if (result.discovery) await saveDiscoveryMetadata(registrarId, result.discovery)
    await syncAdapterToDb(adapter)
  } else {
    await db
      .update(crawlJobs)
      .set({
        status: "failed",
        finishedAt,
        errorMessage: result.error ?? "未知错误",
        strategy: result.strategy,
        metrics: result.metrics,
      })
      .where(eq(crawlJobs.id, job.id))
    await log("error", `任务失败(旧价格未被覆盖): ${result.error}`)
  }

  // 无论成败都刷新健康快照
  await refreshHealth(registrarId)

  return {
    jobId: job.id,
    ok: result.ok,
    message: result.ok
      ? `成功: 新增 ${result.metrics.inserted} 条, 更新 ${result.metrics.updated} 条, 跳过 ${result.metrics.skipped} 条`
      : (result.error ?? "采集失败"),
    totalTlds: result.metrics.rows,
    updated: result.metrics.inserted + result.metrics.updated,
    skipped: result.metrics.skipped,
    durationMs,
    error: result.ok ? undefined : result.error,
    strategy: result.strategy,
    coverage: result.metrics.coverage,
  }
}

/** 读取并解密某注册商的激活凭证 */
async function getCredentialForRegistrar(registrarId: number, type?: CredentialType) {
  const rows = await db
    .select()
    .from(registrarCredentials)
    .where(eq(registrarCredentials.registrarId, registrarId))
  const active = rows.filter((r) => r.isActive && (!type || r.type === type))
  if (active.length === 0) return null
  try {
    return decryptCredential(active[0].encryptedPayload)
  } catch {
    return null
  }
}

/**
 * 基于最近 20 次任务重新计算健康快照并写入 registrars.health。
 */
export async function refreshHealth(registrarId: number): Promise<HealthSnapshot> {
  const recent = await db
    .select()
    .from(crawlJobs)
    .where(eq(crawlJobs.registrarId, registrarId))
    .orderBy(desc(crawlJobs.id))
    .limit(20)

  const finished = recent.filter((j) => j.status === "success" || j.status === "failed")
  const successes = finished.filter((j) => j.status === "success")
  const successRate = finished.length > 0 ? successes.length / finished.length : 0

  const latencies = finished
    .filter((j) => j.startedAt && j.finishedAt)
    .map((j) => (j.finishedAt as Date).getTime() - (j.startedAt as Date).getTime())
  const avgLatencyMs =
    latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0

  const lastSuccess = successes[0] ?? null
  const lastFailure = finished.find((j) => j.status === "failed") ?? null

  // coverage 取最近一次成功任务的指标
  const lastMetrics = lastSuccess?.metrics as { coverage?: number } | null
  const coverage = lastMetrics?.coverage ?? 0

  const health: HealthSnapshot = {
    score: computeHealthScore({ successRate, coverage, avgLatencyMs }),
    coverage,
    successRate,
    failureRate: finished.length > 0 ? 1 - successRate : 0,
    avgLatencyMs,
    lastSuccessAt: lastSuccess?.finishedAt?.toISOString() ?? null,
    lastFailureAt: lastFailure?.finishedAt?.toISOString() ?? null,
    failureReason: lastFailure?.errorMessage ?? null,
    currentStrategy: (lastSuccess?.strategy as string | null) ?? null,
  }

  await saveHealthSnapshot(registrarId, health)
  return health
}
