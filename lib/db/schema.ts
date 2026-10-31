import {
  boolean,
  customType,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core"

/** bytea 二进制列：用于注册商 favicon 缓存等小体积二进制数据 */
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea"
  },
  fromDriver(value) {
    return Buffer.isBuffer(value) ? value : Buffer.from(String(value), "binary")
  },
  toDriver(value) {
    return value
  },
})

export const adminLoginAttempts = pgTable("admin_login_attempts", {
  ipHash: text("ip_hash").primaryKey(),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

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
  /** favicon 二进制缓存（bytea），命中时直接返回，无需外部存储 */
  faviconData: bytea("favicon_data"),
  /** favicon 内容类型（image/png 等） */
  faviconContentType: text("favicon_content_type"),
  /** favicon 缓存更新时间 */
  faviconUpdatedAt: timestamp("favicon_updated_at", { withTimezone: true }),
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
  // ---- 新顶级 (newG) 申请信息（仅 type='newG' 使用，来自 ICANN 申请数据）----
  /** 开放状态码：applied | evaluating | contracted | launching（供前台展示） */
  launchStatus: text("launch_status"),
  /** 预计/已公布开放日期，空=待定 */
  launchDate: timestamp("launch_date", { withTimezone: true }),
  /** 申请类别码：general | community | geo | idn */
  launchType: text("launch_type"),
  /** 申请机构名称 */
  applicant: text("applicant"),
  /** ICANN 申请信息来源链接 */
  sourceUrl: text("source_url"),
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
    // ---- 特价/优惠券维度（deals-and-coupons）----
    /** 促销价（首年实际支付价），须低于 register_price；空=无促销 */
    promotionPrice: numeric("promotion_price", { precision: 10, scale: 2 }),
    /** 优惠码（公开来源），空=无 */
    promoCode: text("promo_code"),
    /** 多优惠码数组：[{code, promotionPrice?, promotionEndsAt?, sourceUrl?}]，promoCode 列为主码（第一个/最优惠） */
    promoCodes: jsonb("promo_codes"),
    /** 促销截止时间（UTC），空=长期/未知 */
    promotionEndsAt: timestamp("promotion_ends_at", { withTimezone: true }),
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
  // ---- 特价/优惠券维度（deals-and-coupons）----
  promotionPrice: numeric("promotion_price", { precision: 10, scale: 2 }),
  promoCode: text("promo_code"),
  promoCodes: jsonb("promo_codes"),
  promotionEndsAt: timestamp("promotion_ends_at", { withTimezone: true }),
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

/** 站点设置：单行表(id 固定为 1),后台可编辑标题/描述/Logo/图标/页脚,修改即时生效 */
export const siteSettings = pgTable("site_settings", {
  id: integer("id").primaryKey().default(1),
  // 品牌字标(与语言无关):主体 + 强调色 + 后缀标签,如 TLD | bi | .com
  brandTextMain: text("brand_text_main").notNull().default("TLD"),
  brandTextAccent: text("brand_text_accent").notNull().default("bi"),
  brandSuffix: text("brand_suffix").notNull().default(".com"),
  // 可选图片:填写则覆盖文字标 / 覆盖内置 favicon
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  // SEO / 展示文案:中英双版
  titleZh: text("title_zh").notNull().default(""),
  titleEn: text("title_en").notNull().default(""),
  descriptionZh: text("description_zh").notNull().default(""),
  descriptionEn: text("description_en").notNull().default(""),
  footerDisclaimerZh: text("footer_disclaimer_zh").notNull().default(""),
  footerDisclaimerEn: text("footer_disclaimer_en").notNull().default(""),
  /** 广告位开关：jsonb 数组，存储启用的 position 标识，如 ["home-search","tld-detail-top"]。null=全部启用 */
  adPositionsEnabled: jsonb("ad_positions_enabled"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

/**
 * 分批回填进度：每注册商一行游标，供“逐 TLD 拉取”型注册商(如 Netim)
 * 分批全量回填使用。cron 每次读取游标推进一批，采完自动置 completed。
 * 只增量、幂等；不影响其它注册商与既有采集路径。
 */
export const crawlBackfill = pgTable("crawl_backfill", {
  id: serial("id").primaryKey(),
  registrarId: integer("registrar_id").notNull().unique(),
  /** idle | running | completed | stopped */
  status: text("status").notNull().default("idle"),
  /** 下一批在有效后缀排序集中的起始下标 */
  cursor: integer("cursor").notNull().default(0),
  /** 每批后缀数量 */
  batchSize: integer("batch_size").notNull().default(50),
  /** 启动本轮回填时的有效后缀总数(快照) */
  total: integer("total").notNull().default(0),
  /** 已完成批次数 */
  batchesDone: integer("batches_done").notNull().default(0),
  /** 累计新增+更新的价格条数 */
  pricesUpdated: integer("prices_updated").notNull().default(0),
  /** 最近一批执行时间(cron 据此判断是否到达间隔) */
  lastBatchAt: timestamp("last_batch_at", { withTimezone: true }),
  /** 本轮回填启动时间 */
  startedAt: timestamp("started_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type CrawlBackfillRow = typeof crawlBackfill.$inferSelect

export type SiteSettingsRow = typeof siteSettings.$inferSelect

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

/**
 * 广告位：支持文字 / 图片广告，按位置投放，中英双语，定时上下线。
 * 一个位置(position)可有多条广告，前台按 weight 随机/轮播展示当前生效广告。
 */
export const adSlots = pgTable("ad_slots", {
  id: serial("id").primaryKey(),
  /** 投放位置标识：home-search / tld-detail-top / registrar-detail-top / list-sidebar 等 */
  position: text("position").notNull(),
  /** 广告类型：text | image */
  type: text("type").notNull().default("text"),
  /** 文字广告：标题(中) */
  titleZh: text("title_zh").notNull().default(""),
  /** 文字广告：标题(英) */
  titleEn: text("title_en").notNull().default(""),
  /** 文字广告：副文案(中) */
  subtitleZh: text("subtitle_zh").notNull().default(""),
  /** 文字广告：副文案(英) */
  subtitleEn: text("subtitle_en").notNull().default(""),
  /** 图片广告：图片 URL（image 类型必填） */
  imageUrl: text("image_url"),
  /** 图片广告：alt 文本 */
  imageAlt: text("image_alt"),
  /** 点击跳转链接 */
  linkUrl: text("link_url").notNull().default(""),
  /** 是否新窗口打开 */
  openInNewTab: boolean("open_in_new_tab").notNull().default(true),
  /** rel 属性（默认 sponsored noopener） */
  rel: text("rel").notNull().default("sponsored noopener"),
  /** 权重（越大越优先展示，同位置多条时按权重分配） */
  weight: integer("weight").notNull().default(1),
  /** 是否启用 */
  isActive: boolean("is_active").notNull().default(true),
  /** 上线时间（空=立即） */
  startsAt: timestamp("starts_at", { withTimezone: true }),
  /** 下线时间（空=长期） */
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type AdSlotRow = typeof adSlots.$inferSelect

/** 推广文章:由后台 AI 生成的原创 SEO/GEO 内容 */
export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  /** URL 友好标识(全站唯一) */
  slug: text("slug").notNull().unique(),
  /** 标题 */
  title: text("title").notNull().default(""),
  /** 摘要/导语(用于列表与 meta description) */
  excerpt: text("excerpt").notNull().default(""),
  /** 正文(Markdown) */
  content: text("content").notNull().default(""),
  /** 主题/关键词(生成时使用) */
  topic: text("topic").notNull().default(""),
  /** 语言:zh | en */
  locale: text("locale").notNull().default("zh"),
  /** SEO 关键词(逗号分隔) */
  keywords: text("keywords").notNull().default(""),
  /** 生成所用模型 */
  model: text("model"),
  /** 是否发布(未发布不显示于前台与 sitemap) */
  isPublished: boolean("is_published").notNull().default(false),
  /** 置顶权重(越大越靠前) */
  weight: integer("weight").notNull().default(1),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type ArticleRow = typeof articles.$inferSelect
