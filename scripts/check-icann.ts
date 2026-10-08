import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

async function main() {
  const r = await pool.query(
    `SELECT count(*)::int AS n FROM registrars WHERE is_active = true AND icann_accredited = true`,
  )
  console.log("icann accredited:", r.rows[0].n)
  const s = await pool.query(
    `SELECT slug, icann_accredited, whois_privacy, dnssec, array_length(payment_methods, 1) AS pm FROM registrars WHERE is_active = true AND icann_accredited = true ORDER BY slug`,
  )
  s.rows.forEach((r) =>
    console.log(`${r.slug.padEnd(16)} icann=${r.icann_accredited ? "Y" : "n"} whois=${r.whois_privacy ? "Y" : "n"} dnssec=${r.dnssec ? "Y" : "n"} pm=${r.pm ?? 0}`),
  )
  await pool.end()
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
