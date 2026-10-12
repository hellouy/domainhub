/**
 * 列出 7 天以上未更新的活跃注册商 slug(空格分隔单行)。
 * 供 local-sync.sh 兜底补采使用: 每轮全量采集后仍有过期的, 立即定向重试。
 */
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"

async function main() {
  const res = await db.execute(sql.raw(`
    SELECT r.slug FROM registrars r
    JOIN prices p ON p.registrar_id=r.id
    WHERE r.is_active
    GROUP BY r.slug
    HAVING MAX(p.updated_at) < now() - interval '7 days'`))
  const slugs = (res.rows as { slug: string }[]).map((r) => r.slug)
  if (slugs.length > 0) console.log(slugs.join(" "))
  process.exit(0)
}
main().catch(() => process.exit(0))
