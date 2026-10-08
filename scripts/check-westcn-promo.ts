import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

async function main() {
  const r = await pool.query(
    `SELECT t.tld, p.register_price, p.promotion_price, p.renew_price, p.transfer_price
     FROM prices p JOIN registrars rg ON rg.id = p.registrar_id JOIN tlds t ON t.id = p.tld_id
     WHERE rg.slug = $1 AND t.tld IN ($2, $3, $4) ORDER BY t.tld`,
    ["westcn", "pw", "com", "top"],
  )
  console.log(JSON.stringify(r.rows))
  const promo = await pool.query(
    `SELECT count(*)::int AS n FROM prices p JOIN registrars rg ON rg.id = p.registrar_id
     WHERE rg.slug = $1 AND p.promotion_price IS NOT NULL`,
    ["westcn"],
  )
  console.log("westcn promo rows:", promo.rows[0].n)
  await pool.end()
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
