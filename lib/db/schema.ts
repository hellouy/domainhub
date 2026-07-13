import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core"

export const registrars = pgTable("registrars", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  website: text("website").notNull(),
  description: text("description").notNull().default(""),
  icannAccredited: boolean("icann_accredited").notNull().default(false),
  whoisPrivacy: boolean("whois_privacy").notNull().default(false),
  dnssec: boolean("dnssec").notNull().default(false),
  paymentMethods: text("payment_methods").array().notNull().default([]),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // ---- Sprint 5 平台化新增列（可空，向后兼容） ----
  /** 健康快照：{ score, coverage, successRate, failureRate, avgLatencyMs, lastSuccessAt, lastFailureAt, failureReason, currentStrategy } */
  health: jsonb("health"),
  /** 适配器负责人（团队/人名） */
  owner: text("owner"),
  /** 当前注册的适配器版本 */
  adapterVersion: text("adapter_version"),
  /** 采集优先级（数字越小越优先） */
  priority: integer("priority"),
})

export const tlds = pgTable("tlds", {
  id: serial("id").primaryKey(),
  tld: text("tld").notNull().unique(),
  type: text("type").notNull().default("gTLD"),
  description: text("description").notNull().default(""),
  isPopular: boolean("is_popular").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** 是否为 IANA 认可的真实后缀（清洗脚本维护，false 的不在前台展示） */
  isValid: boolean("is_valid").notNull().default(true),
  /** 热度分（越大越靠前；0 为普通后缀） */
  popularity: integer("popularity").notNull().default(0),
})

/** 汇率缓存：单行 USD 基准，来自 exchangerate-api.com，智能过期刷新 */
export const exchangeRates = pgTable("exchange_rates", {
  id: serial("id").primaryKey(),
  base: text("base").notNull().default("USD"),
  /** { EUR: 0.87, CNY: 6.78, ... } 1 USD 兑换量 */
  rates: jsonb("rates").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  /** API 声明的下次更新时间，过期才重新拉取 */
  nextUpdateAt: timestamp("next_update_at", { withTimezone: true }),
})

export const prices = pgTable(
  "prices",
  {
    id: serial("id").primaryKey(),
    registrarId: integer("registrar_id").notNull(),
    tldId: integer("tld_id").notNull(),
    registerPrice: numeric("register_price", { precision: 10, scale: 2 }),
    renewPrice: numeric("renew_price", { precision: 10, scale: 2 }),
    transferPrice: numeric("transfer_price", { precision: 10, scale: 2 }),
    currency: text("currency").notNull().default("USD"),
    sourceUrl: text("source_url"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.registrarId, t.tldId)],
)

export const priceHistory = pgTable("price_history", {
  id: serial("id").primaryKey(),
  registrarId: integer("registrar_id").notNull(),
  tldId: integer("tld_id").notNull(),
  registerPrice: numeric("register_price", { precision: 10, scale: 2 }),
  renewPrice: numeric("renew_price", { precision: 10, scale: 2 }),
  transferPrice: numeric("transfer_price", { precision: 10, scale: 2 }),
  currency: text("currency").notNull().default("USD"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
})

export const crawlJobs = pgTable("crawl_jobs", {
  id: serial("id").primaryKey(),
  registrarId: integer("registrar_id").notNull(),
  status: text("status").notNull().default("pending"),
  trigger: text("trigger").notNull().default("manual"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  pricesUpdated: integer("prices_updated").notNull().default(0),
  totalTlds: integer("total_tlds").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // ---- Sprint 5 平台化新增列（可空，向后兼容） ----
  /** 本次任务实际使用的数据源策略（api/json/html/...） */
  strategy: text("strategy"),
  /** 分阶段指标：{ discoveryMs, downloadMs, parsingMs, validationMs, databaseMs, totalMs, rows, inserted, updated, skipped, rejected, retries, coverage } */
  metrics: jsonb("metrics"),
})

export const crawlLogs = pgTable("crawl_logs", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  level: text("level").notNull().default("info"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

// ============================================================
// Sprint 5 平台化新表（只增不改，向后兼容）
// ============================================================

/** 注册商凭证：加密存储（AES-256-GCM），永不明文落库 */
export const registrarCredentials = pgTable("registrar_credentials", {
  id: serial("id").primaryKey(),
  registrarId: integer("registrar_id").notNull(),
  /** api_key | bearer | cookie | session | basic | custom_header */
  type: text("type").notNull(),
  /** 凭证标签（如 "生产 API Key"），便于后台辨认 */
  label: text("label").notNull().default(""),
  /** AES-256-GCM 密文，格式 iv:tag:ciphertext（hex） */
  encryptedPayload: text("encrypted_payload").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

/** 注册商能力表：一商一行 */
export const registrarCapabilities = pgTable(
  "registrar_capabilities",
  {
    id: serial("id").primaryKey(),
    registrarId: integer("registrar_id").notNull(),
    /** 能力集合：registration/renewal/transfer/restore/premiumDomains/dnssec/whoisPrivacy/bulkSearch/nameservers/api/coupons/affiliate/marketplace/supportedTldCount/supportedCurrencies/supportedLanguages */
    capabilities: jsonb("capabilities").notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.registrarId)],
)

/** 数据源发现元数据：一商一行 */
export const discoveryMetadata = pgTable(
  "discovery_metadata",
  {
    id: serial("id").primaryKey(),
    registrarId: integer("registrar_id").notNull(),
    pricingUrl: text("pricing_url"),
    apiEndpoint: text("api_endpoint"),
    xhrEndpoint: text("xhr_endpoint"),
    graphqlEndpoint: text("graphql_endpoint"),
    /** 探测选中的策略 */
    detectedStrategy: text("detected_strategy"),
    authRequired: boolean("auth_required").notNull().default(false),
    jsRequired: boolean("js_required").notNull().default(false),
    contentType: text("content_type"),
    lastVerified: timestamp("last_verified", { withTimezone: true }),
    /** 数据源指纹（结构 hash），用于检测源结构变化 */
    fingerprint: text("fingerprint"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.registrarId)],
)

/** 采集队列：抽象 Queue 的数据库实现 */
export const crawlQueue = pgTable("crawl_queue", {
  id: serial("id").primaryKey(),
  registrarId: integer("registrar_id").notNull(),
  /** pending | running | completed | warning | failed | cancelled | retrying */
  status: text("status").notNull().default("pending"),
  /** 数字越小越优先 */
  priority: integer("priority").notNull().default(100),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  lastError: text("last_error"),
  /** 关联的 crawl_jobs.id（执行后回填） */
  jobId: integer("job_id"),
  /** manual | cron | api */
  trigger: text("trigger").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

/** LLM 修复代理生成的动态适配器规则：一商多版本,active 的生效 */
export const adapterRules = pgTable("adapter_rules", {
  id: serial("id").primaryKey(),
  registrarId: integer("registrar_id").notNull(),
  /** 声明式表格适配器配置(urls/columnOrder/numberFormat 等),见 packages/ai-repair/schema.ts */
  config: jsonb("config").notNull(),
  /** active | candidate | rejected | superseded */
  status: text("status").notNull().default("candidate"),
  /** 产出该规则的模型 ID(如 google/gemini-3-flash);人工创建为 manual */
  modelUsed: text("model_used").notNull().default("manual"),
  /** 验证摘要: 解析条数、样本、校验结果 */
  verification: jsonb("verification"),
  /** 触发原因: initial | repair | manual */
  trigger: text("trigger").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type Registrar = typeof registrars.$inferSelect
export type Tld = typeof tlds.$inferSelect
export type Price = typeof prices.$inferSelect
export type CrawlJob = typeof crawlJobs.$inferSelect
export type CrawlLog = typeof crawlLogs.$inferSelect
export type RegistrarCredential = typeof registrarCredentials.$inferSelect
export type RegistrarCapability = typeof registrarCapabilities.$inferSelect
export type DiscoveryMetadataRow = typeof discoveryMetadata.$inferSelect
export type CrawlQueueItem = typeof crawlQueue.$inferSelect
export type AdapterRule = typeof adapterRules.$inferSelect
