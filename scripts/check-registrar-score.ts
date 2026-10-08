import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

const COVERAGE_FULL_AT = 500

function compute(r: {
  tldCount: number
  promoCount: number
  completeCount: number
  icann: boolean
  whois: boolean
  dnssec: boolean
  pmCount: number
  health: number | null
}) {
  const coverage = Math.min(1, Math.log10(r.tldCount + 1) / Math.log10(COVERAGE_FULL_AT + 1))
  const promo = Math.min(1, (r.tldCount > 0 ? r.promoCount / r.tldCount : 0) * 1.5)
  const completeness = r.tldCount > 0 ? Math.min(1, r.completeCount / r.tldCount) : 0
  const capability = ((r.icann ? 1 : 0) + (r.whois ? 1 : 0) + (r.dnssec ? 1 : 0) + Math.min(r.pmCount, 4) / 4) / 4
  const health = r.health == null ? 0.5 : Math.min(1, Math.max(0, r.health / 100))
  const score = Math.round(35 * coverage + 25 * promo + 15 * completeness + 15 * capability + 10 * health)
  return { score, coverage, promo, completeness, capability, health }
}

async function main() {
  const res = await pool.query(`
    SELECT rg.slug, rg.icann_accredited, rg.whois_privacy, rg.dnssec, rg.payment_methods, rg.health,
      count(p.id)::int AS tld_count,
      count(p.promotion_price)::int AS promo_count,
      count(*) FILTER (WHERE p.register_price IS NOT NULL AND p.renew_price IS NOT NULL)::int AS complete_count
    FROM registrars rg LEFT JOIN prices p ON p.registrar_id = rg.id
    WHERE rg.is_active = true
    GROUP BY rg.id
  `)
  const rows = res.rows.map((r) => {
    const s = compute({
      tldCount: r.tld_count,
      promoCount: r.promo_count,
      completeCount: r.complete_count,
      icann: r.icann_accredited,
      whois: r.whois_privacy,
      dnssec: r.dnssec,
      pmCount: Array.isArray(r.payment_methods) ? r.payment_methods.length : 0,
      health: r.health && typeof r.health.score === "number" ? r.health.score : null,
    })
    return { slug: r.slug, tld: r.tld_count, promoCount: r.promo_count, ...s }
  })
  rows.sort((a, b) => b.score - a.score || b.tld - a.tld)
  console.log("TOP 12:")
  rows.slice(0, 12).forEach((r, i) =>
    console.log(`${String(i + 1).padStart(2)} ${r.slug.padEnd(18)} score=${r.score} tld=${String(r.tld).padEnd(4)} promo=${String(r.promoCount).padEnd(4)} cov=${r.coverage.toFixed(2)} pr=${r.promo.toFixed(2)} comp=${r.completeness.toFixed(2)} cap=${r.capability.toFixed(2)} hlt=${r.health.toFixed(2)}`),
  )
  console.log("BOTTOM 8:")
  rows.slice(-8).forEach((r) =>
    console.log(`   ${r.slug.padEnd(18)} score=${r.score} tld=${String(r.tld).padEnd(4)} promo=${r.promoCount}`),
  )
  await pool.end()
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
