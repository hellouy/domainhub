/**
 * BaseAdapter —— 统一 9 阶段生命周期的基类实现
 *
 * 所有权：Platform Team
 * 文档：docs/adapter-sdk.md
 *
 * 生命周期：initialize → discover → fetch → parse → validate →
 *           normalize → compare → save → cleanup
 *
 * fetch/parse 由策略引擎驱动（自动降级）；compare/save 由 Storage 平台
 * 执行（差异对比、只写变化行、追加历史）。适配器通常只需要通过
 * defineAdapter 声明策略即可，不需要重写任何生命周期方法。
 */

import type {
  AdapterContext,
  AdapterDefinition,
  AdapterResult,
  CrawlMetrics,
  DiscoveryInfo,
  NormalizedPrice,
  RawPrice,
  StrategyType,
  ValidatedPrice,
} from "./types"
import { SDK_VERSION } from "./types"
import { executeStrategies } from "./strategy-engine"
import { validatePrices, type ExistingPriceLookup } from "./validation"
import { parsePriceString } from "../parser"

/** compare + save 的持久化接口，由 Storage 平台实现（避免 SDK 依赖数据库） */
export interface PriceSink {
  /** 查询现有价格（compare 阶段与突变校验用） */
  lookupExisting: ExistingPriceLookup
  /** 保存已通过校验的价格，返回统计 */
  save: (
    prices: ValidatedPrice[],
  ) => Promise<{ inserted: number; updated: number; skipped: number; databaseMs: number }>
}

const emptyMetrics = (): CrawlMetrics => ({
  discoveryMs: 0,
  downloadMs: 0,
  parsingMs: 0,
  validationMs: 0,
  databaseMs: 0,
  totalMs: 0,
  rows: 0,
  inserted: 0,
  updated: 0,
  skipped: 0,
  rejected: 0,
  warnings: 0,
  retries: 0,
  coverage: 0,
  strategyAttempts: [],
  selectedStrategy: null,
})

export class BaseAdapter {
  readonly definition: AdapterDefinition

  constructor(definition: AdapterDefinition) {
    this.definition = definition
  }

  get slug(): string {
    return this.definition.slug
  }
  get name(): string {
    return this.definition.name
  }
  get version(): string {
    return this.definition.version
  }
  get parserVersion(): string {
    return this.definition.parserVersion
  }
  get sdkVersion(): string {
    return SDK_VERSION
  }
  /** 策略优先级列表（如 ["api","json","html"]） */
  get strategyPriority(): StrategyType[] {
    return this.definition.strategies.map((s) => s.type)
  }

  /** initialize：默认执行 hooks.initialize */
  protected async initialize(ctx: AdapterContext): Promise<void> {
    await this.definition.hooks?.initialize?.(ctx)
  }

  /** discover：默认从策略定义推导发现元数据 */
  protected async discover(ctx: AdapterContext): Promise<DiscoveryInfo> {
    if (this.definition.hooks?.discover) {
      return this.definition.hooks.discover(ctx)
    }
    const first = this.definition.strategies[0]
    const info: DiscoveryInfo = {
      detectedStrategy: first?.type,
      jsRequired: this.strategyPriority.includes("playwright"),
      authRequired: this.strategyPriority.includes("private-api"),
    }
    for (const s of this.definition.strategies) {
      if (s.type === "api" || s.type === "private-api") info.apiEndpoint ??= s.url
      else if (s.type === "xhr") info.xhrEndpoint ??= s.url
      else if (s.type === "graphql") info.graphqlEndpoint ??= s.url
      else info.pricingUrl ??= s.url
    }
    return info
  }

  /** normalize：RawPrice → NormalizedPrice（统一结构，补全默认值） */
  protected normalize(
    rawPrices: RawPrice[],
    strategy: StrategyType,
    sourceDescription: string,
  ): NormalizedPrice[] {
    const collectedAt = new Date().toISOString()
    const result: NormalizedPrice[] = []
    for (const raw of rawPrices) {
      const tld = raw.tld.trim().toLowerCase().replace(/^\./, "")
      if (!tld) continue
      result.push({
        registrar: this.slug,
        tld,
        currency: raw.currency ?? this.definition.currency,
        registerPrice: parsePriceString(raw.registerPrice),
        renewPrice: parsePriceString(raw.renewPrice),
        transferPrice: parsePriceString(raw.transferPrice),
        restorePrice: parsePriceString(raw.restorePrice),
        premium: raw.premium ?? false,
        promotion: raw.promotion ?? false,
        promoCode: raw.promoCode ?? null,
        region: raw.region ?? null,
        billingPeriod: raw.billingPeriod ?? "1y",
        source: sourceDescription,
        sourceUrl: raw.sourceUrl ?? null,
        strategy,
        adapterVersion: this.version,
        parserVersion: this.parserVersion,
        collectedAt,
      })
    }
    return result
  }

  /** validate：默认用校验平台，可被 hooks.validate 覆盖 */
  protected async validate(
    prices: NormalizedPrice[],
    ctx: AdapterContext,
    lookupExisting?: ExistingPriceLookup,
  ): Promise<ValidatedPrice[]> {
    if (this.definition.hooks?.validate) {
      return this.definition.hooks.validate(prices, ctx)
    }
    return validatePrices(prices, this.definition.currency, lookupExisting)
  }

  /** cleanup：默认执行 hooks.cleanup，失败不影响结果 */
  protected async cleanup(ctx: AdapterContext): Promise<void> {
    try {
      await this.definition.hooks?.cleanup?.(ctx)
    } catch (err) {
      await ctx.log("warn", `cleanup 阶段出错（已忽略）：${err instanceof Error ? err.message : err}`)
    }
  }

  /**
   * run：驱动完整生命周期。
   * sink 为空时跳过 compare/save（用于连通性/解析测试）。
   */
  async run(ctx: AdapterContext, sink?: PriceSink): Promise<AdapterResult> {
    const totalStarted = Date.now()
    const metrics = emptyMetrics()
    let discovery: DiscoveryInfo | null = null

    try {
      // 1. initialize
      await this.initialize(ctx)

      // 2. discover
      const discoveryStarted = Date.now()
      discovery = await this.discover(ctx)
      metrics.discoveryMs = Date.now() - discoveryStarted

      // 3+4. fetch + parse（策略引擎，自动降级）
      const execution = await executeStrategies(this.definition.strategies, ctx)
      metrics.downloadMs = execution.downloadMs
      metrics.parsingMs = execution.parsingMs
      metrics.strategyAttempts = execution.attempts
      metrics.selectedStrategy = execution.strategy
      if (discovery) discovery.detectedStrategy = execution.strategy

      // 5. normalize（先于 validate：校验作用于标准化结构）
      const sourceDef = this.definition.strategies.find((s) => s.type === execution.strategy)
      const normalized = this.normalize(
        execution.rawPrices,
        execution.strategy,
        `${this.slug} ${execution.strategy}${sourceDef?.url ? ` (${sourceDef.url})` : ""}`,
      )

      // 6. validate
      const validationStarted = Date.now()
      const validated = await this.validate(normalized, ctx, sink?.lookupExisting)
      metrics.validationMs = Date.now() - validationStarted
      metrics.rows = validated.length
      metrics.rejected = validated.filter((v) => v.status === "rejected").length
      metrics.warnings = validated.filter((v) => v.status === "warning").length

      const accepted = validated.filter((v) => v.status !== "rejected")
      if (accepted.length === 0) {
        throw new Error(`校验后无可用价格（共 ${validated.length} 条，全部被拒绝）`)
      }
      if (metrics.rejected > 0) {
        await ctx.log("warn", `校验拒绝 ${metrics.rejected} 条，警告 ${metrics.warnings} 条`)
      }

      // coverage：数据源覆盖已收录后缀的比例
      if (ctx.knownTlds.size > 0) {
        const covered = new Set(accepted.map((v) => v.price.tld))
        let hit = 0
        for (const t of ctx.knownTlds) if (covered.has(t)) hit++
        metrics.coverage = hit / ctx.knownTlds.size
      }

      // 7+8. compare + save（Storage 平台）
      if (sink) {
        const stats = await sink.save(accepted)
        metrics.inserted = stats.inserted
        metrics.updated = stats.updated
        metrics.skipped = stats.skipped
        metrics.databaseMs = stats.databaseMs
      }

      metrics.totalMs = Date.now() - totalStarted
      return {
        ok: true,
        registrar: this.slug,
        strategy: execution.strategy,
        prices: accepted,
        metrics,
        discovery,
      }
    } catch (err) {
      metrics.totalMs = Date.now() - totalStarted
      return {
        ok: false,
        registrar: this.slug,
        strategy: metrics.selectedStrategy,
        prices: [],
        metrics,
        discovery,
        error: err instanceof Error ? err.message : String(err),
      }
    } finally {
      // 9. cleanup
      await this.cleanup(ctx)
    }
  }
}
