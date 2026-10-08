import { readFileSync } from "node:fs"
import { Pool } from "pg"

const html = readFileSync("/tmp/opencode/vw/icann2.html", "utf8")
const re = /<span[^>]*ng-star-inserted[^>]*>([^<]{3,120}?)\s*-\s*(\d{1,6})<\/span>/g
const icann: string[] = []
let m: RegExpExecArray | null
while ((m = re.exec(html))) icann.push(m[1].trim())
const icannSet = new Set(icann.map((s) => s.toLowerCase()))

function inIcann(name: string): string | null {
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, "")
  for (const ic of icann) {
    if (ic.replace(/[^a-z0-9]/g, "") === n) return ic
  }
  return null
}

// Ambiguous resolver: known legal names for problematic slugs
// ICANN accredited registrars confirmed against official list
const RESOLVED: Record<string, string | null> = {
  gname: "gname 001 inc",
  onamae: "gmo internet group, inc. d/b/a onamae.com",
  kouming: "Hongkong Kouming International Limited",
  "muumuu-domain": null,
  activedomains: null,
  hostafrica: "host africa (pty.) ltd.",
  hostingkr: "Megazone Corp., dba HOSTING.KR",
  "22cn": null,
  "59cn": null,
  active24: null,
  ccireg: null,
  cloudns: null,
  cndns: null,
  connectreseller: null,
  cpi: null,
  directnic: null,
  dotology: null,
  exabytes: null,
  forpsi: null,
  gzidc: null,
  icdsoft: null,
  idwebhost: null,
  interserver: null,
  istanco: null,
  iwantmyname: null,
  keliweb: null,
  krystal: null,
  lcn: null,
  mchost: null,
  metaname: null,
  onlydomains: null,
  openprovider: null,
  pskz: null,
  regtons: null,
  tierra: null,
  truehost: null,
  ultahost: null,
  "value-domain": null,
  vsys: null,
  westcn: null,
  whc: null,
  wpx: null,
  zwcn: null,
  // Known ICANN accredited, matched from CURATED MAP + known facts
  "101domain": "101domain grs limited",
  cloudflare: "cloudflare, inc.",
  dynadot: "dynadot inc",
  gandi: "gandi sas",
  hostinger: "hostinger operations, uab",
  hostpoint: "hostpoint ag",
  namecom: "name.com, inc.",
  namesilo: "namesilo, llc",
  networksolutions: "network solutions, llc",
  one: "one.com a/s",
  ovhcloud: "ovh sas",
  porkbun: "porkbun llc",
  spaceship: "spaceship, inc.",
  xserver: "xserver, inc.",
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

async function main() {
  const res = await pool.query(
    `SELECT slug, name FROM registrars WHERE is_active = true ORDER BY slug`,
  )

  const toUpdate: string[] = []
  const skip: string[] = []

  for (const r of res.rows) {
    if (r.slug in RESOLVED) {
      const legalName = RESOLVED[r.slug]
      if (legalName && icannSet.has(legalName.toLowerCase())) {
        toUpdate.push(r.slug)
        console.log(`  ADD  ${r.slug.padEnd(20)} → "${legalName}"`)
      } else {
        skip.push(r.slug)
        console.log(`  SKIP ${r.slug.padEnd(20)} → null (not in ICANN list)`)
      }
      continue
    }
    const hit = inIcann(r.name)
    if (hit) {
      toUpdate.push(r.slug)
      console.log(`  AUTO ${r.slug.padEnd(20)} → "${hit}"`)
    } else {
      skip.push(r.slug)
      console.log(`  NULL ${r.slug.padEnd(20)} → no match`)
    }
  }

  console.log(`\nWill set icann_accredited=true for ${toUpdate.length} registrars`)
  if (toUpdate.length > 0) {
    const r2 = await pool.query(
      `UPDATE registrars SET icann_accredited = true
       WHERE slug = ANY($1) AND is_active = true
       RETURNING slug`,
      [toUpdate],
    )
    console.log("Updated:", r2.rowCount, r2.rows.map((x) => x.slug).join(", "))
  }

  console.log(`\nSkipped (${skip.length}): ${skip.join(", ")}`)
  await pool.end()
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
