/**
 * Adapter SDK 2.0 — 核心类型定义
 *
 * 所有权：Platform Team
 * 文档：docs/adapter-sdk.md
 *
 * 每个注册商适配器实现完全相同的契约（9 阶段生命周期）。
 * 注册商特定逻辑只允许存在于适配器内部，业务逻辑不得依赖 UI 或队列实现。
 */

export const SDK_VERSION = "2.0.0"

// ============================================================
// 数据源策略
// ============================================================

/** 支持的数据源策略类型（按典型优先级排列） */
export type StrategyType =
  | "api" // 官方公开 API
  | "private-api" // 需凭证的私有 API
  | "json" // 静态/社区 JSON 数据集
  | "xhr" // 站点内部 XHR 端点
  | "graphql" // GraphQL 端点
  | "hydration" // Next.js __NEXT_DATA__ 水合数据
  | "nuxt-payload" // Nuxt __NUXT__ payload
  | "embedded-json" // 页面内嵌 JSON（script 标签等）
  | "html" // 结构化 HTML 解析
  | "csv" // CSV 下载
  | "xml" // XML 数据源
  | "rss" // RSS 订阅
  | "playwright" // 无头浏览器（最后手段，需专用运行环境）

/** 单个策略的执行记录（写入 metrics 与日志） */
export interface StrategyAttempt {
  strategy: StrategyType
  ok: boolean
  latencyMs: number
  failureReason?: string
}

// ============================================================
// 价格模型
// ============================================================

/**
 * 适配器 parse 阶段返回的原始价格行。
 * 只需要提供拿得到的字段，normalize 阶段会补全为 NormalizedPrice。
 */
export interface RawPrice {
  /** 后缀，可带点（.com）或不带（com），normalize 阶段统一 */
  tld: string
  registerPrice?: number | string | null
  renewPrice?: number | string | null
  transferPrice?: number | string | null
  restorePrice?: number | string | null
  currency?: string
  premium?: boolean
  promotion?: boolean
  promoCode?: string | null
  region?: string | null
  billingPeriod?: string
  sourceUrl?: string
}

/**
 * 标准化价格模型 —— 所有适配器的最终输出结构，禁止自定义结构。
 * 未来的适配器（含 AI 生成的）必须返回该结构。
 */
export interface NormalizedPrice {
  /** registrars.slug */
  registrar: string
  /** 后缀，不含点，小写，如 "com" */
  tld: string
  /** ISO 4217 货币代码 */
  currency: string
  registerPrice: number | null
  renewPrice: number | null
  transferPrice: number | null
  restorePrice: number | null
  premium: boolean
  promotion: boolean
  promoCode: string | null
  /** 区域定价（如按国家/地区），默认 null 表示全球 */
  region: string | null
  /** 计费周期，默认 "1y" */
  billingPeriod: string
  /** 数据源描述（如 "porkbun official pricing api"） */
  source: string
  sourceUrl: string | null
  /** 实际使用的策略 */
  strategy: StrategyType
  adapterVersion: string
  parserVersion: string
  /** ISO 8601 时间戳 */
  collectedAt: string
}

// ============================================================
// 校验平台
// ============================================================

export type ValidationStatus = "valid" | "warning" | "rejected"

export interface ValidationIssue {
  /** negative-price | currency-mismatch | missing-renewal | duplicate | outlier | large-change */
  code: string
  message: string
}

export interface ValidatedPrice {
  price: NormalizedPrice
  status: ValidationStatus
  issues: ValidationIssue[]
}

// ============================================================
// 能力注册表
// ============================================================

/** 注册商能力声明（存入 registrar_capabilities.capabilities） */
export interface RegistrarCapabilities {
  registration?: boolean
  renewal?: boolean
  transfer?: boolean
  restore?: boolean
  premiumDomains?: boolean
  dnssec?: boolean
  whoisPrivacy?: boolean
  bulkSearch?: boolean
  nameservers?: boolean
  api?: boolean
  coupons?: boolean
  affiliate?: boolean
  marketplace?: boolean
  supportedTldCount?: number
  supportedCurrencies?: string[]
  supportedLanguages?: string[]
}

// ============================================================
// 限流 / 代理
// ============================================================

export interface RateLimitConfig {
  /** 最大并发请求数，默认 2 */
  concurrency?: number
  /** 每分钟请求数上限，默认 30 */
  rpm?: number
  /** 最大重试次数，默认 3 */
  retries?: number
  /** 退避基数毫秒（指数退避），默认 1000 */
  backoffMs?: number
  /** 单请求超时毫秒，默认 60000 */
  timeoutMs?: number
  /** 退避抖动比例 0-1，默认 0.2 */
  jitter?: number
  /** 熔断：连续失败 N 次后打开熔断器，默认 5 */
  circuitBreakerThreshold?: number
  /** 熔断冷却毫秒，默认 300000（5 分钟） */
  circuitBreakerCooldownMs?: number
}

export type ProxyType =
  | "none"
  | "http"
  | "https"
  | "socks5"
  | "residential"
  | "datacenter"
  | "rotating"

/** 代理配置（架构抽象，供应商无关） */
export interface ProxyConfig {
  type: ProxyType
  /** 代理地址，如 http://host:port（none 时省略） */
  url?: string
  username?: string
  password?: string
}

// ============================================================
// 凭证
// ============================================================

export type CredentialType =
  | "api_key"
  | "bearer"
  | "cookie"
  | "session"
  | "basic"
  | "custom_header"

/** 解密后的凭证载荷 */
export interface CredentialPayload {
  type: CredentialType
  /** api_key/bearer: token；basic: user/pass；cookie/session: cookie 串；custom_header: 头名+值 */
  values: Record<string, string>
}

// ============================================================
// 指标
// ============================================================

/** 分阶段采集指标（写入 crawl_jobs.metrics） */
export interface CrawlMetrics {
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
  warnings: number
  retries: number
  /** 数据源覆盖的已收录后缀比例 0-1 */
  coverage: number
  /** 策略尝试记录 */
  strategyAttempts: StrategyAttempt[]
  /** 最终选中的策略 */
  selectedStrategy: StrategyType | null
}

// ============================================================
// 生命周期上下文与结果
// ============================================================

/** 发现阶段产出的数据源元信息（存入 discovery_metadata） */
export interface DiscoveryInfo {
  pricingUrl?: string
  apiEndpoint?: string
  xhrEndpoint?: string
  graphqlEndpoint?: string
  detectedStrategy?: StrategyType
  authRequired?: boolean
  jsRequired?: boolean
  contentType?: string
  /** 数据源结构指纹（hash），用于检测结构漂移 */
  fingerprint?: string
}

/**
 * AdapterContext —— 生命周期各阶段共享的上下文。
 * 由平台注入，适配器不得自行构造。
 */
export interface AdapterContext {
  /** registrars.id */
  registrarId: number
  /** registrars.slug */
  slug: string
  /** 结构化日志（写入 crawl_logs） */
  log: (level: "info" | "warn" | "error", message: string) => Promise<void>
  /** 平台受控 fetch：自动应用限流、重试、退避、超时、熔断、代理 */
  fetch: (url: string, init?: RequestInit) => Promise<Response>
  /** 获取该注册商的解密凭证（无则返回 null） */
  getCredential: (type?: CredentialType) => Promise<CredentialPayload | null>
  /** 已收录的 TLD 集合（不含点），用于 coverage 计算 */
  knownTlds: Set<string>
  /** 记录重试次数（供指标） */
  addRetry: () => void
}

/** 单次采集的最终结果 */
export interface AdapterResult {
  ok: boolean
  registrar: string
  strategy: StrategyType | null
  prices: ValidatedPrice[]
  metrics: CrawlMetrics
  discovery: DiscoveryInfo | null
  error?: string
}

// ============================================================
// 策略定义与适配器定义（defineAdapter 的输入）
// ============================================================

/**
 * 单个数据源策略的实现。
 * fetch 拿原始数据，parse 转成 RawPrice[]。
 * parse 省略时由 Parser 平台自动选择解析器。
 */
export interface StrategyDefinition {
  type: StrategyType
  /** 数据源 URL（供发现元数据与默认 fetch 使用） */
  url?: string
  /** 自定义抓取；省略时用 ctx.fetch(url) */
  fetch?: (ctx: AdapterContext) => Promise<string>
  /** 自定义解析；省略时用 Parser 平台 autoParser */
  parse?: (raw: string, ctx: AdapterContext) => Promise<RawPrice[]> | RawPrice[]
}

/** defineAdapter() 的配置对象 —— 新增注册商只需要写这一个对象 */
export interface AdapterDefinition {
  /** registrars.slug，必须与数据库一致 */
  slug: string
  name: string
  website?: string
  /** 负责人（团队/人名） */
  owner?: string
  /** 适配器版本 semver */
  version: string
  /** 解析器版本 semver */
  parserVersion: string
  /** 默认币种（RawPrice 未提供 currency 时使用） */
  currency: string
  /** 按优先级排列的策略列表，自动降级 */
  strategies: StrategyDefinition[]
  /** 能力声明（自动注册到能力注册表） */
  capabilities?: RegistrarCapabilities
  /** 限流配置 */
  rateLimit?: RateLimitConfig
  /** 代理配置 */
  proxy?: ProxyConfig
  /** 采集优先级（数字越小越优先），默认 100 */
  priority?: number
  /** 可选生命周期钩子 */
  hooks?: AdapterHooks
}

/** 可选生命周期钩子（默认实现已覆盖常见场景） */
export interface AdapterHooks {
  /** initialize：采集前准备（校验凭证等） */
  initialize?: (ctx: AdapterContext) => Promise<void>
  /** discover：探测数据源，返回发现元数据（默认由策略定义推导） */
  discover?: (ctx: AdapterContext) => Promise<DiscoveryInfo>
  /** validate：自定义校验（默认用校验平台） */
  validate?: (prices: NormalizedPrice[], ctx: AdapterContext) => Promise<ValidatedPrice[]>
  /** cleanup：采集后清理（关闭连接等） */
  cleanup?: (ctx: AdapterContext) => Promise<void>
}
