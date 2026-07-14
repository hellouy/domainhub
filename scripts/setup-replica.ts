/**
 * 备库（Supabase）初始化脚本 —— 建齐需要复制的业务表
 * ------------------------------------------------------------
 * 只创建供公开前台/API 故障切换读取的表；不创建凭证/队列/日志等运维表。
 * 幂等（CREATE TABLE IF NOT EXISTS），可重复执行。DDL 与 lib/db/schema.ts 对齐。
 *
 * 运行（需先在项目环境配置 REPLICA_DATABASE_URL = Supabase 连接串）：
 *   set -a && source /vercel/share/.env.project && set +a && npx tsx scripts/setup-replica.ts
 */
import { Pool } from "pg"

const statements: Array<{ label: string; sql: string }> = [
  {
    label: "registrars",
    sql: `CREATE TABLE IF NOT EXISTS registrars (
      id serial PRIMARY KEY,
      slug text NOT NULL UNIQUE,
      name text NOT NULL,
      website text NOT NULL,
      description text NOT NULL DEFAULT '',
      icann_accredited boolean NOT NULL DEFAULT false,
      whois_privacy boolean NOT NULL DEFAULT false,
      dnssec boolean NOT NULL DEFAULT false,
      payment_methods text[] NOT NULL DEFAULT '{}',
      logo_url text,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      health jsonb,
      owner text,
      adapter_version text,
      priority integer
    );`,
  },
  {
    label: "tlds",
    sql: `CREATE TABLE IF NOT EXISTS tlds (
      id serial PRIMARY KEY,
      tld text NOT NULL UNIQUE,
      type text NOT NULL DEFAULT 'gTLD',
      description text NOT NULL DEFAULT '',
      is_popular boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      is_valid boolean NOT NULL DEFAULT true,
      popularity integer NOT NULL DEFAULT 0
    );`,
  },
  {
    label: "exchange_rates",
    sql: `CREATE TABLE IF NOT EXISTS exchange_rates (
      id serial PRIMARY KEY,
      base text NOT NULL DEFAULT 'USD',
      rates jsonb NOT NULL,
      fetched_at timestamptz NOT NULL DEFAULT now(),
      next_update_at timestamptz
    );`,
  },
  {
    label: "prices",
    sql: `CREATE TABLE IF NOT EXISTS prices (
      id serial PRIMARY KEY,
      registrar_id integer NOT NULL,
      tld_id integer NOT NULL,
      register_price numeric(10,2),
      renew_price numeric(10,2),
      transfer_price numeric(10,2),
      currency text NOT NULL DEFAULT 'USD',
      source_url text,
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT prices_registrar_id_tld_id_unique UNIQUE (registrar_id, tld_id)
    );`,
  },
  {
    label: "price_history",
    sql: `CREATE TABLE IF NOT EXISTS price_history (
      id serial PRIMARY KEY,
      registrar_id integer NOT NULL,
      tld_id integer NOT NULL,
      register_price numeric(10,2),
      renew_price numeric(10,2),
      transfer_price numeric(10,2),
      currency text NOT NULL DEFAULT 'USD',
      recorded_at timestamptz NOT NULL DEFAULT now()
    );`,
  },
  {
    label: "crawl_jobs",
    sql: `CREATE TABLE IF NOT EXISTS crawl_jobs (
      id serial PRIMARY KEY,
      registrar_id integer NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      trigger text NOT NULL DEFAULT 'manual',
      started_at timestamptz,
      finished_at timestamptz,
      prices_updated integer NOT NULL DEFAULT 0,
      total_tlds integer NOT NULL DEFAULT 0,
      error_message text,
      created_at timestamptz NOT NULL DEFAULT now(),
      strategy text,
      metrics jsonb
    );`,
  },
  {
    label: "adapter_rules",
    sql: `CREATE TABLE IF NOT EXISTS adapter_rules (
      id serial PRIMARY KEY,
      registrar_id integer NOT NULL,
      config jsonb NOT NULL,
      status text NOT NULL DEFAULT 'candidate',
      model_used text NOT NULL DEFAULT 'manual',
      verification jsonb,
      trigger text NOT NULL DEFAULT 'manual',
      created_at timestamptz NOT NULL DEFAULT now()
    );`,
  },
  {
    label: "registrar_capabilities",
    sql: `CREATE TABLE IF NOT EXISTS registrar_capabilities (
      id serial PRIMARY KEY,
      registrar_id integer NOT NULL,
      capabilities jsonb NOT NULL DEFAULT '{}',
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT registrar_capabilities_registrar_id_unique UNIQUE (registrar_id)
    );`,
  },
  {
    label: "discovery_metadata",
    sql: `CREATE TABLE IF NOT EXISTS discovery_metadata (
      id serial PRIMARY KEY,
      registrar_id integer NOT NULL,
      pricing_url text,
      api_endpoint text,
      xhr_endpoint text,
      graphql_endpoint text,
      detected_strategy text,
      auth_required boolean NOT NULL DEFAULT false,
      js_required boolean NOT NULL DEFAULT false,
      content_type text,
      last_verified timestamptz,
      fingerprint text,
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT discovery_metadata_registrar_id_unique UNIQUE (registrar_id)
    );`,
  },
  {
    label: "site_settings",
    sql: `CREATE TABLE IF NOT EXISTS site_settings (
      id integer PRIMARY KEY DEFAULT 1,
      brand_text_main text NOT NULL DEFAULT 'TLD',
      brand_text_accent text NOT NULL DEFAULT 'bi',
      brand_suffix text NOT NULL DEFAULT '.com',
      logo_url text,
      favicon_url text,
      title_zh text NOT NULL DEFAULT '',
      title_en text NOT NULL DEFAULT '',
      description_zh text NOT NULL DEFAULT '',
      description_en text NOT NULL DEFAULT '',
      footer_disclaimer_zh text NOT NULL DEFAULT '',
      footer_disclaimer_en text NOT NULL DEFAULT '',
      updated_at timestamptz NOT NULL DEFAULT now()
    );`,
  },
]

async function main() {
  const url = process.env.REPLICA_DATABASE_URL
  if (!url) {
    console.error("REPLICA_DATABASE_URL 未设置：请先配置 Supabase 连接串")
    process.exit(1)
  }
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })
  try {
    for (const { label, sql } of statements) {
      await pool.query(sql)
      console.log(`✓ ${label}`)
    }
    console.log("备库初始化完成，可运行同步：services/replication")
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error("备库初始化失败:", err)
  process.exit(1)
})
