import { db } from "@/lib/db"
import { registrarCredentials, registrars, tlds } from "@/lib/db/schema"
import { decryptCredential } from "@/packages/credentials"
import { eq } from "drizzle-orm"

const API_BASE = "https://rest.netim.com/1.0"

async function main() {
  const reg = await db.select().from(registrars).where(eq(registrars.slug, "netim"))
  const creds = await db
    .select()
    .from(registrarCredentials)
    .where(eq(registrarCredentials.registrarId, reg[0].id))
  const active = creds.find((c) => c.isActive && c.type === "basic")
  if (!active) throw new Error("无 basic 凭证")
  const cred = decryptCredential(active.encryptedPayload)
  const basic = Buffer.from(`${cred.values.username}:${cred.values.password}`).toString("base64")

  const sess = await fetch(`${API_BASE}/session`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json", "Accept-Language": "EN" },
  })
  const token = String(((await sess.json()) as Record<string, unknown>).access_token ?? "")
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

  // 取全部后缀连续查询，定位从第几个开始失败
  const allTlds = await db.select({ tld: tlds.tld }).from(tlds)
  const tldNames = allTlds.map((s) => s.tld.replace(/^\./, "").toLowerCase())
  console.log("[v0] 后缀总数:", tldNames.length)

  const statusCount: Record<string, number> = {}
  const failedSamples: string[] = []
  let i = 0
  let firstFailIdx = -1
  const t0 = Date.now()
  for (const tld of tldNames) {
    i++
    const r = await fetch(`${API_BASE}/tld/${encodeURIComponent(tld)}/`, { headers: auth })
    const key = String(r.status)
    statusCount[key] = (statusCount[key] ?? 0) + 1
    if (!r.ok) {
      if (firstFailIdx === -1) {
        firstFailIdx = i
        console.log(`[v0] 首次失败在第 ${i} 个(${tld})，此时已耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`)
      }
      if (failedSamples.length < 8) {
        const body = await r.text().catch(() => "")
        failedSamples.push(`#${i} ${tld} → ${r.status}: ${body.slice(0, 120)}`)
      }
    }
    // 累计失败到 30 次即停止，够定位规律
    if ((statusCount["401"] ?? 0) + (statusCount["429"] ?? 0) + (statusCount["403"] ?? 0) >= 30) break
  }
  console.log("[v0] 已查询个数:", i)
  console.log("[v0] HTTP 状态分布:", JSON.stringify(statusCount))
  console.log("[v0] 失败样例:")
  for (const s of failedSamples) console.log("[v0]   ", s)

  await fetch(`${API_BASE}/session`, { method: "DELETE", headers: auth }).catch(() => undefined)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[v0] 失败:", e.message)
    process.exit(1)
  })
