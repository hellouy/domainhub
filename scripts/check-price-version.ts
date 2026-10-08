import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

async function main() {
  const slug = process.argv[2] || "westcn"
  const tld = process.argv[3] || "pw"
  const r = await pool.query(
    `SELECT t.tld, p.register_price, p.renew_price, p.updated_at
     FROM prices p JOIN registrars rg ON rg.id = p.registrar_id JOIN tlds t ON t.id = p.tld_id
     WHERE rg.slug = $1 AND t.tld = $2`,
    [slug, tld],
  )
  console.log("row:", JSON.stringify(r.rows))
  await pool.end()
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
