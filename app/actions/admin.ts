"use server"

import { db } from "@/lib/db"
import { registrars } from "@/lib/db/schema"
import {
  createAdminSession,
  destroyAdminSession,
  isAdminAuthenticated,
  verifyPassword,
} from "@/lib/admin-auth"
import { runCrawlJob } from "@/lib/crawler/runner"
import { auditService } from "@/services/audit"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) throw new Error("未授权")
}

export async function adminLogin(_prevState: { error?: string } | null, formData: FormData) {
  const password = String(formData.get("password") ?? "")
  if (!password || !verifyPassword(password)) {
    void auditService.audit("auth.login_failed", "管理员登录失败（密码错误）")
    return { error: "密码错误，请重试" }
  }
  await createAdminSession()
  void auditService.audit("auth.login", "管理员登录成功")
  redirect("/admin")
}

export async function adminLogout() {
  await destroyAdminSession()
  redirect("/admin/login")
}

export async function triggerCrawl(registrarId: number) {
  await requireAdmin()
  const result = await runCrawlJob(registrarId)
  revalidatePath("/admin")
  revalidatePath("/admin/crawls")
  revalidatePath("/", "layout")
  return result
}

export async function triggerCrawlAll() {
  await requireAdmin()
  const active = await db.select().from(registrars).where(eq(registrars.isActive, true))
  const results = []
  for (const r of active) {
    results.push(await runCrawlJob(r.id))
  }
  revalidatePath("/admin")
  revalidatePath("/admin/crawls")
  revalidatePath("/", "layout")
  return results
}

export async function toggleRegistrarActive(registrarId: number, isActive: boolean) {
  await requireAdmin()
  void auditService.audit("registrar.toggle", `注册商 #${registrarId} ${isActive ? "启用" : "停用"}`)
  await db.update(registrars).set({ isActive }).where(eq(registrars.id, registrarId))
  revalidatePath("/admin/registrars")
  revalidatePath("/", "layout")
}

export async function updateRegistrar(registrarId: number, formData: FormData) {
  await requireAdmin()
  const name = String(formData.get("name") ?? "").trim()
  const website = String(formData.get("website") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  if (!name || !website) throw new Error("名称和网址为必填项")
  void auditService.audit("registrar.update", `编辑注册商 #${registrarId}：${name}`)
  await db
    .update(registrars)
    .set({ name, website, description })
    .where(eq(registrars.id, registrarId))
  revalidatePath("/admin/registrars")
  revalidatePath("/", "layout")
}
