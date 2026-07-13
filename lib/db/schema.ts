import {
  boolean,
  integer,
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
})

export const tlds = pgTable("tlds", {
  id: serial("id").primaryKey(),
  tld: text("tld").notNull().unique(),
  type: text("type").notNull().default("gTLD"),
  description: text("description").notNull().default(""),
  isPopular: boolean("is_popular").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
  retries: integer("retries").notNull().default(0),
  rowsInserted: integer("rows_inserted").notNull().default(0),
  rowsUpdated: integer("rows_updated").notNull().default(0),
  rowsSkipped: integer("rows_skipped").notNull().default(0),
  rowsRejected: integer("rows_rejected").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const schedulerSettings = pgTable("scheduler_settings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  runHourUtc: integer("run_hour_utc").notNull().default(2),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const crawlLogs = pgTable("crawl_logs", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  level: text("level").notNull().default("info"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const metrics = pgTable("metrics", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  value: numeric("value", { precision: 14, scale: 3 }).notNull(),
  unit: text("unit").notNull().default(""),
  context: text("context").notNull().default(""),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
})

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  requestId: text("request_id").notNull().default(""),
  actor: text("actor").notNull().default("admin"),
  action: text("action").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type Registrar = typeof registrars.$inferSelect
export type Tld = typeof tlds.$inferSelect
export type Price = typeof prices.$inferSelect
export type CrawlJob = typeof crawlJobs.$inferSelect
export type CrawlLog = typeof crawlLogs.$inferSelect
export type SchedulerSettings = typeof schedulerSettings.$inferSelect
export type Metric = typeof metrics.$inferSelect
export type AuditLog = typeof auditLogs.$inferSelect
