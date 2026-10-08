import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

async function main() {
  const r = await pool.query(
    `SELECT tld, popularity, is_popular FROM tlds WHERE is_popular = true ORDER BY popularity DESC`,
  )
  console.log("is_popular count:", r.rows.length)
  r.rows.forEach((x) => console.log(`${x.tld.padEnd(6)} popularity=${x.popularity}`))
  await pool.end()
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
