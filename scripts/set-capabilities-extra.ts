import { Pool } from "pg"

const EXTRA: Record<string, { whois?: boolean; dnssec?: boolean; pm?: string[] }> = {
  "muumuu-domain": { whois: true, dnssec: true, pm: ["信用卡", "银行转账"] },
  stardomain: { whois: true, dnssec: true, pm: ["信用卡", "银行转账"] },
  alldomains: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  vsys: { whois: true, dnssec: true, pm: ["信用卡", "PayPal", "银行转账"] },
  cpi: { whois: true, dnssec: true, pm: ["信用卡", "银行转账"] },
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

async function main() {
  let updated = 0
  for (const [slug, cap] of Object.entries(EXTRA)) {
    const sets: string[] = []
    const params: unknown[] = []
    if (cap.whois !== undefined) {
      params.push(cap.whois)
      sets.push(`whois_privacy = $${params.length}`)
    }
    if (cap.dnssec !== undefined) {
      params.push(cap.dnssec)
      sets.push(`dnssec = $${params.length}`)
    }
    if (cap.pm !== undefined) {
      params.push(cap.pm)
      sets.push(`payment_methods = $${params.length}`)
    }
    if (sets.length === 0) continue
    params.push(slug)
    const res = await pool.query(
      `UPDATE registrars SET ${sets.join(", ")} WHERE slug = $${params.length} AND is_active = true RETURNING slug`,
      params,
    )
    if (res.rowCount === 1) {
      updated++
      console.log("updated", slug)
    } else {
      console.log("NO ROW for", slug)
    }
  }
  console.log("total updated:", updated)
  await pool.end()
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
