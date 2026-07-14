/**
 * 内容/规则表增量迁移脚本
 *
 * 补齐 schema.ts 中已定义、但此前建表脚本未创建的两张表：
 *   - site_settings   后台可编辑的站点品牌/SEO/页脚设置（单行表，id 固定为 1）
 *   - adapter_rules   LLM 修复代理生成的动态适配器规则（一商多版本，active 生效）
 *
 * 原则：只增不改 —— 不删表、不改列名、不破坏现有数据。
 * 幂等：所有语句使用 IF NOT EXISTS，可重复执行。
 *
 * 运行：
 *   set -a && source /vercel/share/.env.project && set +a && npx tsx scripts/setup-content-db.ts
 */
import { Pool } from "pg"

const statements: Array<{ label: string; sql: string }> = [
  {
    label: "site_settings 表",
    sql: `
      CREATE TABLE IF NOT EXISTS site_settings (
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
      );
    `,
  },
  {
    label: "adapter_rules 表",
    sql: `
      CREATE TABLE IF NOT EXISTS adapter_rules (
        id serial PRIMARY KEY,
        registrar_id integer NOT NULL,
        config jsonb NOT NULL,
        status text NOT NULL DEFAULT 'candidate',
        model_used text NOT NULL DEFAULT 'manual',
        verification jsonb,
        trigger text NOT NULL DEFAULT 'manual',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_adapter_rules_registrar_status
        ON adapter_rules (registrar_id, status);
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
