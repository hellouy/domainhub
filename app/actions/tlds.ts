"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { tlds } from "@/lib/db/schema"
import { isAdminAuthenticated } from "@/lib/admin-auth"

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) throw new Error("未授权")
}

function revalidateTld() {
  revalidatePath("/admin/tlds")
  revalidatePath("/", "layout")
}

/** 切换热门标记 */
export async function toggleTldPopular(tldId: number, isPopular: boolean) {
  await requireAdmin()
  await db.update(tlds).set({ isPopular }).where(eq(tlds.id, tldId))
  revalidateTld()
}

/** 切换 IANA 有效标记（false 的后缀不在前台展示） */
export async function toggleTldValid(tldId: number, isValid: boolean) {
  await requireAdmin()
  await db.update(tlds).set({ isValid }).where(eq(tlds.id, tldId))
  revalidateTld()
}

/** 编辑后缀：类型、介绍文案、热度分 */
export async function updateTld(tldId: number, formData: FormData) {
  await requireAdmin()
  const type = String(formData.get("type") ?? "gTLD").trim() || "gTLD"
  const description = String(formData.get("description") ?? "").trim()
  const popularityRaw = String(formData.get("popularity") ?? "0").trim()
  const popularity = Number.parseInt(popularityRaw, 10)
  if (Number.isNaN(popularity) || popularity < 0) throw new Error("热度分必须为非负整数")
  await db
    .update(tlds)
    .set({ type, description, popularity })
    .where(eq(tlds.id, tldId))
  revalidateTld()
}
