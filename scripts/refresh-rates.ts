/**
 * 手动刷新汇率缓存:清空旧缓存 → 走回退链重新拉取 → 写回数据库。
 * 用法: npx tsx scripts/refresh-rates.ts
 */
import { db } from "../lib/db"
import { exchangeRates } from "../lib/db/schema"
import { getUsdRates } from "../lib/fx"

async function main() {
  await db.delete(exchangeRates)
  console.log("旧缓存已清空")
  const rates = await getUsdRates()
  console.log("回退链拉取成功 | 币种数:", Object.keys(rates).length, "| CNY:", rates.CNY, "| EUR:", rates.EUR)
  const rows = await db.select().from(exchangeRates)
  console.log("已写回数据库 | 行数:", rows.length, "| 下次更新:", rows[0]?.nextUpdateAt)
}

main().then(() => process.exit(0))
