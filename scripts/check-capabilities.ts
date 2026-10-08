import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

async function main() {
  const r = await pool.query(
    `SELECT slug, name, icann_accredited, whois_privacy, dnssec, payment_methods
     FROM registrars WHERE is_active = true ORDER BY slug`,
  )
  const filled = r.rows.filter(
    (x) => x.whois_privacy || x.dnssec || (Array.isArray(x.payment_methods) && x.payment_methods.length > 0),
  )
  console.log(`active registrars: ${r.rows.length}, with any capability set: ${filled.length}`)
  filled.forEach((x) =>
    console.log(
      `${x.slug.padEnd(18)} whois=${x.whois_privacy ? "Y" : "n"} dnssec=${x.dnssec ? "Y" : "n"} pm=${JSON.stringify(x.payment_methods ?? [])}`,
    ),
  )
  console.log("\n--- never set (sample) ---")
  r.rows
    .filter(
      (x) => !x.whois_privacy && !x.dnssec && (!Array.isArray(x.payment_methods) || x.payment_methods.length === 0),
    )
    .slice(0, 10)
    .forEach((x) => console.log(x.slug))
  await pool.end()
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
