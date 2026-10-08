import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

async function main() {
  const slug = process.argv[2] || "juming"
  const r = await pool.query(
    `SELECT COUNT(*) AS total,
       COUNT(*) FILTER (WHERE p.register_price IS NOT NULL) AS with_reg,
       COUNT(*) FILTER (WHERE p.renew_price IS NOT NULL) AS with_renew,
       COUNT(*) FILTER (WHERE p.transfer_price IS NOT NULL) AS with_transfer
     FROM prices p JOIN registrars rg ON rg.id = p.registrar_id
     WHERE rg.slug = $1`,
    [slug],
  )
  console.log(slug, JSON.stringify(r.rows[0]))
  const sample = await pool.query(
    `SELECT t.tld, p.register_price, p.renew_price
     FROM prices p JOIN registrars rg ON rg.id = p.registrar_id JOIN tlds t ON t.id = p.tld_id
     WHERE rg.slug = $1 AND (p.register_price IS NULL OR p.register_price <= 0) LIMIT 10`,
    [slug],
  )
  console.log("no_reg:", JSON.stringify(sample.rows))
  await pool.end()
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
