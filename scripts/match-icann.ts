import { readFileSync } from "node:fs"
import { Pool } from "pg"

const html = readFileSync("/tmp/opencode/vw/icann2.html", "utf8")
const re = /<span[^>]*ng-star-inserted[^>]*>([^<]{3,120}?)\s*-\s*(\d{1,6})<\/span>/g
const icann = new Set<string>()
let m: RegExpExecArray | null
while ((m = re.exec(html))) icann.add(m[1].trim().toLowerCase())

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|limited|gmbh|sas|bv|co|corp|corporation|company|uab|s\.a\.|pte|pty|kk|og|plc|spa|ab|as|oy|d\/b\/a|dba)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")

const icannNorm = [...icann].map((n) => ({ raw: n, norm: norm(n) }))

function match(name: string): string | null {
  const n = norm(name)
  const exact = icannNorm.find((x) => x.norm === n)
  if (exact) return exact.raw
  const partial = icannNorm.filter((x) => x.norm.includes(n) || n.includes(x.norm))
  if (partial.length === 1) return partial[0].raw
  if (partial.length > 1) return `AMBIGUOUS(${partial.length}): ${partial.slice(0, 3).join(" | ")}`
  return null
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
async function main() {
  const res = await pool.query(`SELECT slug, name, icann_accredited FROM registrars WHERE is_active = true ORDER BY slug`)
  const out: string[] = []
  for (const r of res.rows) {
    const hit = match(r.name)
    if (hit && !hit.startsWith("AMBIGUOUS")) {
      out.push(`  "${r.slug}": "${hit}",`)
    }
    console.log(`${r.slug.padEnd(20)} db_flag=${r.icann_accredited ? "Y" : "n"} ${hit ?? "NO_MATCH"}`)
  }
  console.log("\n--- CURATED MAP ---\n" + out.join("\n"))
  await pool.end()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
