import { Pool } from "pg"

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  const rows = await pool.query(`
    SELECT r.id, r.slug, r.name, r.website, r.is_active,
           count(p.id) as price_count,
           j.status as last_status,
           j.error_message,
           j.created_at as last_crawl
    FROM registrars r
    LEFT JOIN prices p ON p.registrar_id = r.id
    LEFT JOIN LATERAL (
      SELECT * FROM crawl_jobs cj WHERE cj.registrar_id = r.id ORDER BY created_at DESC LIMIT 1
    ) j ON true
    WHERE r.is_active = false
    GROUP BY r.id, j.status, j.error_message, j.created_at
    ORDER BY r.id
  `)

  console.log("=== 18 家已禁用注册商详情 ===\n")
  for (const r of rows.rows) {
    const last = r.last_crawl ? new Date(r.last_crawl).toISOString().slice(0, 10) : "从未"
    const err = r.error_message ? r.error_message.slice(0, 150) : "-"
    console.log(`[${r.id}] ${r.slug} | ${r.name}`)
    console.log(`  网站: ${r.website}`)
    console.log(`  价格数: ${r.price_count} | 最后采集: ${last} | 状态: ${r.last_status || "-"}`)
    console.log(`  错误: ${err}`)
    console.log()
  }

  await pool.end()
}

main().catch(console.error)
