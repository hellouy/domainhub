import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

async function main() {
  const r = await pool.query(
    `SELECT count(*)::int AS total,
       count(*) FILTER (WHERE popularity > 0)::int AS with_pop,
       count(*) FILTER (WHERE is_popular)::int AS pop
     FROM tlds`,
  )
  console.log("total:", r.rows[0].total, "with_popularity>0:", r.rows[0].with_pop, "is_popular:", r.rows[0].pop)
  const top = await pool.query(
    `SELECT tld, popularity FROM tlds WHERE popularity > 0 ORDER BY popularity DESC LIMIT 30`,
  )
  console.log("top popularity:", top.rows.map((x) => `${x.tld}=${x.popularity}`).join(" "))
  await pool.end()
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
