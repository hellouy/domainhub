/**
 * 采集引擎（Crawler Engine）核心类型定义
 *
 * 分层架构：
 *   Adapter（lib/crawler/adapters）  —— 每个注册商一个，只负责"从哪取、字段怎么对应"
 *   Parser（services/parser）        —— HTML / JSON / XML -> 原始记录，解析逻辑不允许写在 Adapter 里
 *   Normalizer（BaseAdapter.normalize）—— 原始记录 -> 统一的 DomainPrice
 *   Storage（services/storage）      —— 差异写入 prices / price_history / crawl_logs / crawl_jobs
 *   Runner（services/crawler）       —— 调度、重试、超时、取消、统计
 */

/** 任务状态机（warning：任务完成但存在被验证拒绝的记录） */
export type JobStatus = "pending" | "running" | "success" | "warning" | "failed" | "cancelled"

/** 采集内容的原始载体（fetch 阶段的输出，parse 阶段的输入） */
export interface RawContent {
  kind: "json" | "html" | "xml"
  body: string
  /** 数据来源地址（写入 prices.source_url，便于溯源） */
  sourceUrl: string
}

/**
 * 统一的归一化价格结构 —— 所有 Adapter 的最终输出
 * 字段与产品规范一致：registrar/tld/register_price/renew_price/transfer_price/currency/source/checked_at
 */
export interface DomainPrice {
  /** 注册商 slug（registrars.slug） */
  registrar: string
  /** 后缀，不含点，如 "com" */
  tld: string
  register_price: number | null
  renew_price: number | null
  transfer_price: number | null
  /** ISO 4217 币种，如 "USD" / "CNY" */
  currency: string
  /** 数据来源地址 */
  source: string
  /** 采集时间 */
  checked_at: Date
}

/** 运行上下文：由 Runner 注入，Adapter / Storage 通过它写日志、响应取消 */
export interface CrawlContext {
  jobId: number
  /** 写一条采集日志（落库到 crawl_logs） */
  log: (level: "info" | "warn" | "error", message: string) => Promise<void>
  /** 是否已被请求取消（Adapter 应在耗时步骤之间检查） */
  isCancelled: () => boolean
}

/** 单次任务的统计结果（Runner 返回、后台展示） */
export interface CrawlJobResult {
  jobId: number
  registrarSlug: string
  status: JobStatus
  ok: boolean
  message: string
  /** 数据源覆盖的后缀总数 */
  totalTlds: number
  /** 实际写入/更新的行数（价格有变化才计入） */
  updated: number
  /** 其中新插入的行数 */
  inserted: number
  /** 无变化被跳过的行数 */
  skipped: number
  /** 被数据验证拒绝的行数 */
  rejected: number
  /** 实际执行的尝试次数（含重试） */
  attempts: number
  durationMs: number
  error?: string
}

/** Runner 行为配置 */
export interface RunnerOptions {
  /** 失败后最大尝试次数（默认 3） */
  maxAttempts?: number
  /** 单次尝试超时（默认 60s） */
  timeoutMs?: number
}

/**
 * 兼容旧接口的 Adapter 形状（Runner 依赖的最小契约）。
 * BaseAdapter 实现了它；旧代码（如 CrawlOneButton）无需改动。
 */
export interface RegistrarAdapter {
  slug: string
  name: string
  /** 采集方式说明（后台展示用） */
  strategy: string
  /** 完整生命周期入口：initialize -> fetch -> parse -> normalize（save/finish 由 Runner + Storage 负责） */
  collect: (ctx: CrawlContext) => Promise<DomainPrice[]>
}
