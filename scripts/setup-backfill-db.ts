/**
 * 分批回填进度表 增量迁移脚本
 *
 * 原则：只增不改 —— 不删表、不改列名、不破坏现有数据。
 * 幂等：CREATE TABLE IF NOT EXISTS，可重复执行。
 *
 * 运行：
 *   set -a && source /vercel/share/.env.project && set +a && npx tsx scripts/setup-backfill-db.ts
 */
import { Pool } from "pg"

const statements: Array<{ label: string; sql: string }> = [
  {
    label: "crawl_backfill 表（每注册商一行回填进度游标）",
    sql: `
      CREATE TABLE IF NOT EXISTS crawl_backfill (
        id serial PRIMARY KEY,
        registrar_id integer NOT NULL,
        status text NOT NULL DEFAULT 'idle',
        cursor integer NOT NULL DEFAULT 0,
        batch_size integer NOT NULL DEFAULT 50,
        total integer NOT NULL DEFAULT 0,
        batches_done integer NOT NULL DEFAULT 0,
        prices_updated integer NOT NULL DEFAULT 0,
        last_batch_at timestamptz,
        started_at timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT crawl_backfill_registrar_id_unique UNIQUE (registrar_id)
      );
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
      `SELECT column_name FROM information_schema.columns WHERE table_name='crawl_backfill' ORDER BY ordinal_position`,
    )
    console.log("crawl_backfill 列:", rows.map((r) => r.column_name).join(", "))
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error("迁移失败:", err)
  process.exit(1)
})
