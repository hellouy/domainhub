"use server"

/**
 * 凭证管理 Server Actions
 * ------------------------------------------------------------
 * 所有权: Platform Team
 * 文档: docs/credentials.md
 *
 * 所有操作要求管理员会话。凭证以 AES-256-GCM 加密存储,
 * 列表接口只返回脱敏值, 明文永不出库。
 */

import { desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { registrarCredentials, registrars } from "@/lib/db/schema"
import {
  decryptCredential,
  encryptCredential,
  maskCredential,
  type CredentialPayload,
  type CredentialType,
} from "@/packages/credentials"

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) throw new Error("未授权")
}

const VALID_TYPES: CredentialType[] = [
  "api_key",
  "bearer",
  "cookie",
  "session",
  "basic",
  "custom_header",
]

/** 列出全部凭证(脱敏) */
export async function listCredentials() {
  await requireAdmin()
  const rows = await db
    .select({
      id: registrarCredentials.id,
      registrarId: registrarCredentials.registrarId,
      registrarName: registrars.name,
      registrarSlug: registrars.slug,
      type: registrarCredentials.type,
      label: registrarCredentials.label,
      encryptedPayload: registrarCredentials.encryptedPayload,
      isActive: registrarCredentials.isActive,
      createdAt: registrarCredentials.createdAt,
    })
    .from(registrarCredentials)
    .leftJoin(registrars, eq(registrarCredentials.registrarId, registrars.id))
    .orderBy(desc(registrarCredentials.id))

  return rows.map((r) => {
    let masked: Record<string, string> = {}
    try {
      masked = maskCredential(decryptCredential(r.encryptedPayload))
    } catch {
      masked = { error: "解密失败(密钥可能已更换)" }
    }
    return {
      id: r.id,
      registrarId: r.registrarId,
      registrarName: r.registrarName ?? "未知",
      registrarSlug: r.registrarSlug ?? "",
      type: r.type,
      label: r.label,
      masked,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
    }
  })
}

/** 新增凭证 */
export async function createCredential(formData: FormData) {
  await requireAdmin()

  const registrarId = Number.parseInt(String(formData.get("registrarId")), 10)
  const type = String(formData.get("type")) as CredentialType
  const label = String(formData.get("label") ?? "").trim()

  if (!Number.isFinite(registrarId)) throw new Error("注册商无效")
  if (!VALID_TYPES.includes(type)) throw new Error("凭证类型无效")

  const values: Record<string, string> = {}
  if (type === "api_key" || type === "bearer") {
    const token = String(formData.get("token") ?? "").trim()
    if (!token) throw new Error("token 不能为空")
    values.token = token
  } else if (type === "basic") {
    values.username = String(formData.get("username") ?? "").trim()
    values.password = String(formData.get("password") ?? "").trim()
    if (!values.username || !values.password) throw new Error("用户名与密码不能为空")
  } else if (type === "cookie" || type === "session") {
    const cookie = String(formData.get("cookie") ?? "").trim()
    if (!cookie) throw new Error("cookie 不能为空")
    values.cookie = cookie
  } else {
    values.headerName = String(formData.get("headerName") ?? "").trim()
    values.headerValue = String(formData.get("headerValue") ?? "").trim()
    if (!values.headerName || !values.headerValue) throw new Error("请求头名称与值不能为空")
  }

  const payload: CredentialPayload = { type, values }
  await db.insert(registrarCredentials).values({
    registrarId,
    type,
    label: label || type,
    encryptedPayload: encryptCredential(payload),
  })
  revalidatePath("/admin/credentials")
}

/** 启用/停用凭证 */
export async function toggleCredential(id: number, isActive: boolean) {
  await requireAdmin()
  await db
    .update(registrarCredentials)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(registrarCredentials.id, id))
  revalidatePath("/admin/credentials")
}

/** 删除凭证 */
export async function deleteCredential(id: number) {
  await requireAdmin()
  await db.delete(registrarCredentials).where(eq(registrarCredentials.id, id))
  revalidatePath("/admin/credentials")
}
