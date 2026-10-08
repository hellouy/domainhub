/**
 * 线上 TLD 热度标注(幂等,仅热度相关)
 *   1. 全部 popularity=0、is_popular=false 清零
 *   2. 按共享热度表打分
 *   3. 前 POPULAR_FLAG_COUNT 个(is_valid=true)标记为 is_popular
 *
 * 不影响 is_valid / type 等列。
 * 运行: npx tsx --env-file=.env.local scripts/mark-popular-tlds.ts
 */
import { sql } from "drizzle-orm"
import { db } from "../lib/db"
import { POPULARITY, POPULAR_FLAG_COUNT, popularTlds } from "../lib/tld-popularity"

async function main() {
  await db.execute(sql`UPDATE tlds SET popularity = 0, is_popular = false`)

  for (const [tld, score] of Object.entries(POPULARITY)) {
    await db.execute(sql`UPDATE tlds SET popularity = ${score} WHERE tld = ${tld}`)
  }

  const targets = popularTlds()
  await db.execute(
    sql`UPDATE tlds SET is_popular = true WHERE tld IN (${sql.join(
      targets.map((t) => sql`${t}`),
      sql`, `,
    )}) AND is_valid = true`,
  )

  const scored = await db.execute(
    sql`SELECT count(*)::int AS c FROM tlds WHERE popularity > 0`,
  )
  const flagged = await db.execute(
    sql`SELECT count(*)::int AS c FROM tlds WHERE is_popular = true`,
  )
  console.log(
    `热度标注完成: ${Object.keys(POPULARITY).length} 个后缀已打分,is_popular=${flagged.rows[0].c},popularity>0=${scored.rows[0].c}`,
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
