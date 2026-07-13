/**
 * 一次性清理脚本：删除误入库的 Porkbun Handshake（非 ICANN）后缀
 *
 * 依据 Porkbun 官方 API 的 specialType === "handshake" 标记，
 * 删除对应的 price_history、prices、tlds 记录。
 *
 * 运行：node --env-file-if-exists=/vercel/share/.env.project scripts/cleanup-handshake-tlds.mjs
 */
import pg from "pg"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const res = await fetch("https://api.porkbun.com/api/json/v3/pricing/get", { method: "POST" })
const { pricing } = await res.json()
const handshake = Object.entries(pricing)
  .filter(([, v]) => v?.specialType === "handshake")
  .map(([tld]) => tld)

console.log(`[v0] Handshake 后缀共 ${handshake.length} 个`)

const { rows: ids } = await pool.query("SELECT id FROM tlds WHERE tld = ANY($1)", [handshake])
const idList = ids.map((r) => r.id)
console.log(`[v0] 数据库中命中 ${idList.length} 个`)

if (idList.length > 0) {
  const h = await pool.query("DELETE FROM price_history WHERE tld_id = ANY($1)", [idList])
  const p = await pool.query("DELETE FROM prices WHERE tld_id = ANY($1)", [idList])
  const t = await pool.query("DELETE FROM tlds WHERE id = ANY($1)", [idList])
  console.log(`[v0] 已删除：price_history=${h.rowCount}，prices=${p.rowCount}，tlds=${t.rowCount}`)
}

const tldCount = (await pool.query("SELECT count(*)::int AS count FROM tlds")).rows[0].count
const priceCount = (await pool.query("SELECT count(*)::int AS count FROM prices")).rows[0].count
console.log(`[v0] 清理后：tlds=${tldCount}，prices=${priceCount}`)
await pool.end()
