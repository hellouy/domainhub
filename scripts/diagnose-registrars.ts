import { Pool } from "pg"

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  const total = await pool.query("SELECT count(*) as c FROM registrars")
  const active = await pool.query("SELECT count(*) as c FROM registrars WHERE is_active = true")
  console.log("=== 注册商总览 ===")
  console.log("总数:", total.rows[0].c, "| 启用:", active.rows[0].c)

  const withAdapter = await pool.query(
    "SELECT count(*) as c FROM registrars WHERE is_active = true AND slug IN (SELECT slug FROM adapter_rules)",
  )
  const noAdapter = await pool.query(
    "SELECT count(*) as c FROM registrars WHERE is_active = true AND slug NOT IN (SELECT slug FROM adapter_rules)",
  )
  console.log("启用中有适配器:", withAdapter.rows[0].c, "| 无适配器:", noAdapter.rows[0].c)

  const withPrices = await pool.query("SELECT count(DISTINCT registrar_id) as c FROM prices")
  console.log("有价格数据的注册商:", withPrices.rows[0].c)

  const byRegistrar = await pool.query(`
    SELECT r.id, r.slug, r.name, r.is_active,
           count(p.id) as price_count,
           max(j.created_at) as last_crawl, j.status as last_status
    FROM registrars r
    LEFT JOIN prices p ON p.registrar_id = r.id
    LEFT JOIN LATERAL (
      SELECT * FROM crawl_jobs cj WHERE cj.registrar_id = r.id ORDER BY created_at DESC LIMIT 1
    ) j ON true
    GROUP BY r.id, r.slug, r.name, r.is_active, j.status
    ORDER BY r.is_active DESC, price_count DESC
  `)
  console.log("\n=== 各注册商详情 ===")
  console.log("ID  | slug | 名称 | 启用 | 价格数 | 最后采集 | 状态")
  for (const r of byRegistrar.rows) {
    const last = r.last_crawl ? new Date(r.last_crawl).toISOString().slice(0, 10) : "从未"
    console.log(`${r.id} | ${r.slug} | ${r.name} | ${r.is_active ? "Y" : "N"} | ${r.price_count} | ${last} | ${r.last_status || "-"}`)
  }
  await pool.end()
}

main().catch(console.error)
