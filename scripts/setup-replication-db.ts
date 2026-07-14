/**
 * 复制状态表 增量迁移脚本（在主库 Neon 上运行）
 *
 * 原则：只增不改；幂等（CREATE TABLE IF NOT EXISTS），可重复执行。
 *
 * 运行：
 *   set -a && source /vercel/share/.env.project && set +a && npx tsx scripts/setup-replication-db.ts
 */
import { Pool } from "pg"

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("DATABASE_URL 未设置")
    process.exit(1)
  }
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS replication_state (
        id integer PRIMARY KEY DEFAULT 1,
        last_sync_at timestamptz,
        last_result jsonb,
        last_error text,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `)
    await pool.query(`INSERT INTO replication_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;`)
    console.log("✓ replication_state 表已就绪（主库）")
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error("迁移失败:", err)
  process.exit(1)
})
