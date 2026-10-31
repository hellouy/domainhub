/**
 * Sprint 5 平台化增量迁移脚本
 *
 * 原则：只增不改 —— 不删表、不改列名、不破坏现有数据。
 * 幂等：所有语句使用 IF NOT EXISTS / ADD COLUMN IF NOT EXISTS，可重复执行。
 *
 * 运行：
 *   set -a && source /vercel/share/.env.project && set +a && npx tsx scripts/setup-platform-db.ts
 */
import { Pool } from "pg"

const statements: Array<{ label: string; sql: string }> = [
  {
    label: "registrars 增列（health/owner/adapter_version/priority）",
    sql: `
      ALTER TABLE registrars
        ADD COLUMN IF NOT EXISTS health jsonb,
        ADD COLUMN IF NOT EXISTS owner text,
        ADD COLUMN IF NOT EXISTS adapter_version text,
        ADD COLUMN IF NOT EXISTS priority integer;
    `,
  },
  {
    label: "crawl_jobs 增列（strategy/metrics）",
    sql: `
      ALTER TABLE crawl_jobs
        ADD COLUMN IF NOT EXISTS strategy text,
        ADD COLUMN IF NOT EXISTS metrics jsonb;
    `,
  },
  {
    label: "registrar_credentials 表",
    sql: `
      CREATE TABLE IF NOT EXISTS registrar_credentials (
        id serial PRIMARY KEY,
        registrar_id integer NOT NULL,
        type text NOT NULL,
        label text NOT NULL DEFAULT '',
        encrypted_payload text NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_registrar_credentials_registrar
        ON registrar_credentials (registrar_id);
    `,
  },
  {
    label: "registrar_capabilities 表",
    sql: `
      CREATE TABLE IF NOT EXISTS registrar_capabilities (
        id serial PRIMARY KEY,
        registrar_id integer NOT NULL,
        capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT registrar_capabilities_registrar_id_unique UNIQUE (registrar_id)
      );
    `,
  },
  {
    label: "discovery_metadata 表",
    sql: `
      CREATE TABLE IF NOT EXISTS discovery_metadata (
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
      );
    `,
  },
  {
    label: "crawl_queue 表",
    sql: `
      CREATE TABLE IF NOT EXISTS crawl_queue (
        id serial PRIMARY KEY,
        registrar_id integer NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        priority integer NOT NULL DEFAULT 100,
        attempts integer NOT NULL DEFAULT 0,
        max_attempts integer NOT NULL DEFAULT 3,
        scheduled_at timestamptz NOT NULL DEFAULT now(),
        started_at timestamptz,
        finished_at timestamptz,
        last_error text,
        job_id integer,
        trigger text NOT NULL DEFAULT 'manual',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_crawl_queue_status_priority
        ON crawl_queue (status, priority, scheduled_at);
    `,
  },
  {
    label: "admin_login_attempts 表",
    sql: `
      CREATE TABLE IF NOT EXISTS admin_login_attempts (
        ip_hash text PRIMARY KEY,
        failed_attempts integer NOT NULL DEFAULT 0,
        window_started_at timestamptz NOT NULL DEFAULT now(),
        locked_until timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `,
  },
  {
    label: "ad_slots 广告位表",
    sql: `
      CREATE TABLE IF NOT EXISTS ad_slots (
        id serial PRIMARY KEY,
        position text NOT NULL,
        type text NOT NULL DEFAULT 'text',
        title_zh text NOT NULL DEFAULT '',
        title_en text NOT NULL DEFAULT '',
        subtitle_zh text NOT NULL DEFAULT '',
        subtitle_en text NOT NULL DEFAULT '',
        image_url text,
        image_alt text,
        link_url text NOT NULL DEFAULT '',
        open_in_new_tab boolean NOT NULL DEFAULT true,
        rel text NOT NULL DEFAULT 'sponsored noopener',
        weight integer NOT NULL DEFAULT 1,
        is_active boolean NOT NULL DEFAULT true,
        starts_at timestamptz,
        ends_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_ad_slots_position_active
        ON ad_slots (position, is_active);
    `,
  },
  {
    label: "site_settings 增列 ad_positions_enabled",
    sql: `
      ALTER TABLE site_settings
        ADD COLUMN IF NOT EXISTS ad_positions_enabled jsonb;
    `,
  },
  {
    label: "articles 推广文章表",
    sql: `
      CREATE TABLE IF NOT EXISTS articles (
        id serial PRIMARY KEY,
        slug text NOT NULL UNIQUE,
        title text NOT NULL DEFAULT '',
        excerpt text NOT NULL DEFAULT '',
        content text NOT NULL DEFAULT '',
        topic text NOT NULL DEFAULT '',
        locale text NOT NULL DEFAULT 'zh',
        keywords text NOT NULL DEFAULT '',
        model text,
        is_published boolean NOT NULL DEFAULT false,
        weight integer NOT NULL DEFAULT 1,
        published_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_articles_published
        ON articles (is_published, published_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_slug
        ON articles (slug);
    `,
  },
]

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("DATABASE_URL 未设置")
    process.exit(1)
  }
  const pool = new Pool({ connectionString: url })
  try {
    for (const { label, sql } of statements) {
      await pool.query(sql)
      console.log(`✓ ${label}`)
    }
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`,
    )
    console.log("当前全部表:", rows.map((r) => r.table_name).join(", "))
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error("迁移失败:", err)
  process.exit(1)
})
