/**
 * 临时只读探测：用有效会话试探 Netim REST 1.0 的定价相关端点。
 * 不写任何数据库；只 GET 探测；仅打印状态码与响应片段。用完即删。
 */
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

  const sessRes = await fetch(`${API_BASE}/session`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json", "Accept-Language": "EN" },
  })
  const sess = (await sessRes.json()) as Record<string, unknown>
  const token = String(sess.access_token ?? "")
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
  console.log(`[v0] 会话 token 长度=${token.length}`)

  const candidates = [
    "hello/",
    "account/",
    "tld/com/",
    "tld/com/operations/",
    "tld/com",
    "tlds/",
    "domain/price/",
    "pricelist/",
    "prices/",
    "tld/price/com/",
    "operations/pending/",
  ]
  for (const path of candidates) {
    try {
      const r = await fetch(`${API_BASE}/${path}`, { headers: auth })
      const text = await r.text()
      console.log(`[v0] GET ${path} → ${r.status} | ${text.slice(0, 160).replace(/\s+/g, " ")}`)
    } catch (e) {
      console.log(`[v0] GET ${path} → ERROR ${(e as Error).message}`)
    }
  }

  await fetch(`${API_BASE}/session`, { method: "DELETE", headers: auth }).catch(() => undefined)
  console.log("[v0] 已关闭会话")
}

main().then(() => process.exit(0)).catch((e) => { console.error("[v0] 探测失败:", e.message); process.exit(1) })
