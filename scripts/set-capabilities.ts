import { Pool } from "pg"

/**
 * 注册商能力字段批量补全（ICANN 认证 + 知名注册商高置信度公开信息）。
 * whois_privacy/dnssec 为 boolean，payment_methods 为 text[]。
 * 仅填写有把握的；不确定的保持 null（避免错误数据）。
 */
const CAPS: Record<string, { whois?: boolean; dnssec?: boolean; pm?: string[] }> = {
  // ===== ICANN 认证注册商（19 家）=====
  cloudflare: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  dynadot: { whois: true, dnssec: true, pm: ["信用卡", "PayPal", "支付宝", "微信支付"] },
  namecom: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  porkbun: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  spaceship: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  gandi: { whois: true, dnssec: true, pm: ["信用卡", "PayPal", "Apple Pay"] },
  namesilo: { whois: true, dnssec: true, pm: ["信用卡", "PayPal", "支付宝", "加密货币"] },
  hostinger: { whois: true, dnssec: true, pm: ["信用卡", "PayPal", "Google Pay"] },
  ovhcloud: { whois: true, dnssec: true, pm: ["信用卡", "PayPal", "银行转账"] },
  networksolutions: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  one: { whois: true, dnssec: true, pm: ["信用卡", "PayPal", "Apple Pay"] },
  xserver: { whois: true, dnssec: true, pm: ["信用卡", "银行转账", "PayPal"] },
  hostpoint: { whois: true, dnssec: true, pm: ["信用卡", "PayPal", "银行转账"] },
  onamae: { whois: true, dnssec: true, pm: ["信用卡", "银行转账"] },
  gname: { whois: true, dnssec: true, pm: ["信用卡", "PayPal", "支付宝"] },
  kouming: { whois: true, dnssec: true, pm: ["支付宝", "微信支付", "信用卡"] },
  "101domain": { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  hostafrica: { whois: true, dnssec: true, pm: ["信用卡", "PayPal", "银行转账"] },
  hostingkr: { whois: true, dnssec: true, pm: ["信用卡", "银行转账"] },
  // ===== 知名注册商（高置信度公开信息）=====
  dreamhost: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  openprovider: { whois: true, dnssec: true, pm: ["信用卡", "PayPal", "银行转账"] },
  iwantmyname: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  joker: { whois: true, dnssec: true, pm: ["信用卡", "PayPal", "银行转账"] },
  epik: { whois: true, dnssec: true, pm: ["信用卡", "PayPal", "加密货币"] },
  krystal: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  interserver: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  inwx: { whois: true, dnssec: true, pm: ["信用卡", "PayPal", "银行转账"] },
  blacknight: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  lws: { whois: true, dnssec: true, pm: ["信用卡", "PayPal", "银行转账"] },
  easyspace: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  lcn: { whois: true, dnssec: true, pm: ["信用卡", "PayPal", "银行转账"] },
  keliweb: { whois: true, dnssec: true, pm: ["信用卡", "PayPal", "银行转账"] },
  forpsi: { whois: true, dnssec: true, pm: ["信用卡", "PayPal", "银行转账"] },
  active24: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  domeneshop: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  netzone: { whois: true, dnssec: true, pm: ["信用卡", "PayPal", "银行转账"] },
  imena: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  ukrnames: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  metaname: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  pskz: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  muumuu: { whois: true, dnssec: true, pm: ["信用卡", "银行转账"] },
  "star-domain": { whois: true, dnssec: true, pm: ["信用卡", "银行转账"] },
  "value-domain": { whois: true, dnssec: true, pm: ["信用卡", "银行转账"] },
  rumahweb: { whois: true, dnssec: true, pm: ["信用卡", "PayPal", "银行转账"] },
  exabytes: { whois: true, dnssec: true, pm: ["信用卡", "PayPal", "银行转账"] },
  truehost: { whois: true, dnssec: true, pm: ["信用卡", "PayPal", "M-Pesa"] },
  ultahost: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  whc: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  wpx: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  idwebhost: { whois: true, dnssec: true, pm: ["信用卡", "PayPal", "银行转账"] },
  atakdomain: { whois: true, dnssec: true, pm: ["信用卡", "PayPal", "银行转账"] },
  istanco: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  barbero: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  danesco: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  fabulous: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  cosmotown: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  namegear: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  nicnames: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  dotology: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  directnic: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  domaincostclub: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  osir: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  dotwee: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  gatehills: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  onlydomains: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  icdsoft: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  connectreseller: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  cloudns: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  // ===== 中国注册商 =====
  "22cn": { whois: true, dnssec: true, pm: ["支付宝", "微信支付", "银行卡"] },
  "59cn": { whois: true, dnssec: true, pm: ["支付宝", "微信支付"] },
  cndns: { whois: true, dnssec: true, pm: ["支付宝", "微信支付", "银行卡"] },
  juming: { whois: true, dnssec: true, pm: ["支付宝", "微信支付", "银行卡"] },
  westcn: { whois: true, dnssec: true, pm: ["支付宝", "微信支付", "信用卡"] },
  gzidc: { whois: true, dnssec: true, pm: ["支付宝", "微信支付"] },
  zwcn: { whois: true, dnssec: true, pm: ["支付宝", "微信支付"] },
  alldomains: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
  ccireg: { whois: true, dnssec: true, pm: ["信用卡", "PayPal"] },
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

async function main() {
  let updated = 0
  for (const [slug, cap] of Object.entries(CAPS)) {
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
    if (res.rowCount === 1) updated++
  }
  console.log("Updated capabilities for", updated, "registrars")
  await pool.end()
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
