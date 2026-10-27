import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const active = await pool.query("SELECT count(*) FROM registrars WHERE is_active = true")
  const inactive = await pool.query("SELECT count(*) FROM registrars WHERE is_active = false")
  console.log(`Active: ${active.rows[0].count}, Inactive: ${inactive.rows[0].count}`)

  const inactiveList = await pool.query(`
    SELECT r.id, r.slug, r.name,
      (SELECT count(*) FROM prices p WHERE p.registrar_id = r.id) AS price_count
    FROM registrars r
    WHERE r.is_active = false
    ORDER BY r.id
  `)
  console.log("\nInactive registrars:")
  for (const r of inactiveList.rows) {
    console.log(`  [${r.id}] ${r.slug} (${r.name}) — ${r.price_count} prices`)
  }

  const recovered = await pool.query(`
    SELECT r.id, r.slug, count(p.id) AS price_count
    FROM registrars r
    LEFT JOIN prices p ON p.registrar_id = r.id
    WHERE r.slug IN ('amen','transip','hover','onecom')
    GROUP BY r.id, r.slug
    ORDER BY r.id
  `)
  console.log("\nRecovered registrars:")
  for (const r of recovered.rows) {
    console.log(`  [${r.id}] ${r.slug} — ${r.price_count} prices`)
  }
  await pool.end()
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
