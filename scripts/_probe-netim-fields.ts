/** 临时只读：查看 Netim tld/{tld}/ 的价格字段名。用完即删。 */
import { db } from "@/lib/db"
import { registrarCredentials, registrars } from "@/lib/db/schema"
import { decryptCredential } from "@/packages/credentials"
import { eq } from "drizzle-orm"

const API_BASE = "https://rest.netim.com/1.0"

async function main() {
  const reg = await db.select().from(registrars).where(eq(registrars.slug, "netim"))
  const rows = await db
    .select()
    .from(registrarCredentials)
    .where(eq(registrarCredentials.registrarId, reg[0].id))
  const cred = decryptCredential(rows.filter((r) => r.isActive && r.type === "basic")[0].encryptedPayload)
  const basic = Buffer.from(`${cred.values.username}:${cred.values.password}`).toString("base64")
  const s = await fetch(`${API_BASE}/session`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json", "Accept-Language": "EN" },
  })
  const token = String(((await s.json()) as Record<string, unknown>).access_token ?? "")
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

  for (const t of ["com", "ai", "fr"]) {
    const r = await fetch(`${API_BASE}/tld/${t}/`, { headers: auth })
    const j = (await r.json()) as Record<string, unknown>
    console.log(`[v0] .${t} 全部字段名:`, JSON.stringify(Object.keys(j)))
    const priceKeys = Object.keys(j).filter((k) => /fee|price|create|renew|transfer|restore|tarif|cost/i.test(k))
    const sample: Record<string, unknown> = {}
    for (const k of priceKeys) sample[k] = j[k]
    console.log(`[v0] .${t} 价格字段取值:`, JSON.stringify(sample))
  }
  await fetch(`${API_BASE}/session`, { method: "DELETE", headers: auth }).catch(() => undefined)
}

main().then(() => process.exit(0)).catch((e) => { console.error("[v0]", e.message); process.exit(1) })
