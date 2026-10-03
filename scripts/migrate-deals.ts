/**
 * deals-and-coupons 迁移：prices / price_history 加促销列
 * ------------------------------------------------------------
 * 运行: npx tsx --env-file=.env.local scripts/migrate-deals.ts
 * 幂等: ADD COLUMN IF NOT EXISTS, 可重复执行。
 */
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const MIGRATIONS = [
  `ALTER TABLE prices ADD COLUMN IF NOT EXISTS promotion_price numeric(10,2)`,
  `ALTER TABLE prices ADD COLUMN IF NOT EXISTS promo_code text`,
  `ALTER TABLE prices ADD COLUMN IF NOT EXISTS promotion_ends_at timestamptz`,
  `ALTER TABLE price_history ADD COLUMN IF NOT EXISTS promotion_price numeric(10,2)`,
  `ALTER TABLE price_history ADD COLUMN IF NOT EXISTS promo_code text`,
  `ALTER TABLE price_history ADD COLUMN IF NOT EXISTS promotion_ends_at timestamptz`,
]

async function main() {
  for (const sql of MIGRATIONS) {
    await pool.query(sql)
    console.log("ok:", sql)
  }
  console.log("迁移完成（幂等，可重复执行）")
  process.exit(0)
}
main().catch((err) => {
  console.error(err)
  process.exit(1)
})