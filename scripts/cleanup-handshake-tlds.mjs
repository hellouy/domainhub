/**
 * 一次性清理脚本：删除误入库的 Porkbun Handshake（非 ICANN）后缀
 *
 * 依据 Porkbun 官方 API 的 specialType === "handshake" 标记，
 * 删除对应的 price_history、prices、tlds 记录。
 *
 * 运行：node --env-file-if-exists=/vercel/share/.env.project scripts/cleanup-handshake-tlds.mjs
 */
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL)

const res = await fetch("https://api.porkbun.com/api/json/v3/pricing/get", { method: "POST" })
const { pricing } = await res.json()
const handshake = Object.entries(pricing)
  .filter(([, v]) => v?.specialType === "handshake")
  .map(([tld]) => tld)

console.log(`[v0] Handshake 后缀共 ${handshake.length} 个`)

const ids = await sql`SELECT id FROM tlds WHERE tld = ANY(${handshake})`
const idList = ids.map((r) => r.id)
console.log(`[v0] 数据库中命中 ${idList.length} 个`)

if (idList.length > 0) {
  const h = await sql`DELETE FROM price_history WHERE tld_id = ANY(${idList})`
  const p = await sql`DELETE FROM prices WHERE tld_id = ANY(${idList})`
  const t = await sql`DELETE FROM tlds WHERE id = ANY(${idList})`
  console.log(`[v0] 已删除 price_history/prices/tlds 中的 Handshake 记录`)
}

const [{ count: tldCount }] = await sql`SELECT count(*)::int AS count FROM tlds`
const [{ count: priceCount }] = await sql`SELECT count(*)::int AS count FROM prices`
console.log(`[v0] 清理后：tlds=${tldCount}，prices=${priceCount}`)
