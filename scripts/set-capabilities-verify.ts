/**
 * 补齐 5 家待核实注册商的能力字段(2026-10-08 官网实证)
 *   regtons    : ICANN=Gransy s.r.o. #1505(官方清单精确匹配), WhoIsProxy 明确提供, DNSSEC 明确支持
 *   tierra     : 官网自述 ICANN-Accredited Registrar(DomainDiscover 1999), 母公司 ClearHello/DomainSpot LLC #86
 *   activedomains : 页脚支付图标 银行卡/MIR/СБП/ЮMoney
 *   mchost     : 页脚支付图标 银行卡/WebMoney/加密货币(bitcoin)
 *   julyname   : 官网 WAF 拦截无法核实,保持 null
 * 运行: npx tsx --env-file=.env.local scripts/set-capabilities-verify.ts
 */
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

const ICANN = ["regtons", "tierra"]
const WHOIS = ["regtons"]
const DNSSEC = ["regtons"]
const PM: Record<string, string[]> = {
  activedomains: ["银行卡", "MIR", "СБП", "ЮMoney"],
  mchost: ["银行卡", "WebMoney", "加密货币"],
}

async function main() {
  for (const slug of ICANN) {
    const r = await pool.query(
      `UPDATE registrars SET icann_accredited = true WHERE slug = $1 AND is_active = true RETURNING slug`,
      [slug],
    )
    console.log(`icann_accredited=true: ${r.rowCount} (${slug})`)
  }
  for (const slug of WHOIS) {
    const r = await pool.query(
      `UPDATE registrars SET whois_privacy = true WHERE slug = $1 AND is_active = true RETURNING slug`,
      [slug],
    )
    console.log(`whois_privacy=true: ${r.rowCount} (${slug})`)
  }
  for (const slug of DNSSEC) {
    const r = await pool.query(
      `UPDATE registrars SET dnssec = true WHERE slug = $1 AND is_active = true RETURNING slug`,
      [slug],
    )
    console.log(`dnssec=true: ${r.rowCount} (${slug})`)
  }
  for (const [slug, methods] of Object.entries(PM)) {
    const r = await pool.query(
      `UPDATE registrars SET payment_methods = $2 WHERE slug = $1 AND is_active = true RETURNING slug`,
      [slug, methods],
    )
    console.log(`payment_methods=${JSON.stringify(methods)}: ${r.rowCount} (${slug})`)
  }
  await pool.end()
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
