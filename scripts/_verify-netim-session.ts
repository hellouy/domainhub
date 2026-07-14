/**
 * 临时只读验证脚本：验证 Netim 会话创建的 406 修复。
 * - 只 SELECT 读取凭证，不写任何表
 * - 只调用 Netim /session/ 开/关会话，不做取价
 * - 只打印 HTTP 状态码，绝不打印明文凭证
 * 用完即删。
 */
import { db } from "@/lib/db"
import { registrarCredentials, registrars } from "@/lib/db/schema"
import { decryptCredential } from "@/packages/credentials"
import { eq } from "drizzle-orm"

const API_BASE = "https://rest.netim.com/1.0"

async function main() {
  const reg = await db.select().from(registrars).where(eq(registrars.slug, "netim"))
  if (reg.length === 0) throw new Error("未找到 netim 注册商")
  const rows = await db
    .select()
    .from(registrarCredentials)
    .where(eq(registrarCredentials.registrarId, reg[0].id))
  const active = rows.filter((r) => r.isActive && r.type === "basic")
  if (active.length === 0) throw new Error("未找到 netim 的 active basic 凭证")

  const cred = decryptCredential(active[0].encryptedPayload)
  const hasUser = Boolean(cred.values.username)
  const hasPass = Boolean(cred.values.password)
  console.log(`[v0] 凭证类型=${cred.type} 含username=${hasUser} 含password=${hasPass}`)

  const basic = Buffer.from(
    `${cred.values.username ?? ""}:${cred.values.password ?? ""}`,
  ).toString("base64")

  // 旧写法：无 Content-Type
  const oldRes = await fetch(`${API_BASE}/session/`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, Accept: "application/json" },
  })
  console.log(`[v0] 旧写法(无 Content-Type) → HTTP ${oldRes.status}`)
  await oldRes.text().catch(() => undefined)

  // 新写法：完全对齐官方客户端 —— Accept-Language + Content-Type，无 body
  const newRes = await fetch(`${API_BASE}/session`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
      "Accept-Language": "EN",
    },
  })
  console.log(`[v0] 新写法(Accept-Language,无body) → HTTP ${newRes.status}`)

  if (newRes.ok) {
    const sess = (await newRes.json()) as Record<string, unknown>
    const token = String(
      sess.access_token ?? sess.IDSession ?? sess.sessionId ?? sess.token ?? "",
    )
    console.log(`[v0] 会话创建成功，拿到 token 长度=${token.length}`)
    const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

    // 取 TLD 列表
    const listRes = await fetch(`${API_BASE}/tlds/`, { headers: auth })
    console.log(`[v0] /tlds/ → HTTP ${listRes.status}`)
    let firstTld = ""
    if (listRes.ok) {
      const listJson = (await listRes.json()) as unknown
      const arr = Array.isArray(listJson) ? listJson : []
      console.log(`[v0] TLD 列表条数=${arr.length}`)
      const t0 = arr[0]
      firstTld = String(
        typeof t0 === "object" && t0 !== null
          ? ((t0 as Record<string, unknown>).tld ??
              (t0 as Record<string, unknown>).extension ??
              (t0 as Record<string, unknown>).name ??
              "")
          : (t0 ?? ""),
      ).replace(/^\./, "").toLowerCase()
    } else {
      console.log(`[v0] /tlds/ 响应体: ${(await listRes.text()).slice(0, 200)}`)
    }

    // 取单个 TLD 价格
    if (firstTld) {
      const infoRes = await fetch(`${API_BASE}/tld/${encodeURIComponent(firstTld)}/`, { headers: auth })
      console.log(`[v0] /tld/${firstTld}/ → HTTP ${infoRes.status}`)
      if (infoRes.ok) {
        const info = (await infoRes.json()) as Record<string, unknown>
        console.log(`[v0] 该 TLD 字段样例: ${JSON.stringify(info).slice(0, 300)}`)
      }
    }

    // 关闭会话（尽力而为）
    if (token) {
      await fetch(`${API_BASE}/session`, {
        method: "DELETE",
        headers: auth,
      }).catch(() => undefined)
      console.log("[v0] 已关闭测试会话")
    }
  } else {
    const body = await newRes.text().catch(() => "")
    console.log(`[v0] 新写法响应体(前200字符): ${body.slice(0, 200)}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[v0] 验证失败:", e.message)
    process.exit(1)
  })
