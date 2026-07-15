"use server"

import { db } from "@/lib/db"
import { registrars, siteSettings } from "@/lib/db/schema"
import {
  createAdminSession,
  destroyAdminSession,
  isAdminAuthenticated,
  verifyPassword,
} from "@/lib/admin-auth"
import { runCrawlJob } from "@/lib/crawler/runner"
import { invalidateSiteSettings } from "@/lib/site-settings"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) throw new Error("未授权")
}

export async function adminLogin(_prevState: { error?: string } | null, formData: FormData) {
  const password = String(formData.get("password") ?? "")
  if (!password || !verifyPassword(password)) {
    return { error: "密码错误，请重试" }
  }
  await createAdminSession()
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

/**
 * 探测一个价格页 URL 的可抓取性(不写库)。
 * 管理员在添加注册商时输入网址即可自动尝试多策略抓取并预览结果。
 */
export async function probeRegistrarUrl(url: string) {
  await requireAdmin()
  const { probeUrl } = await import("@/services/crawl/probe")
  return probeUrl(url)
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
  await db
    .update(registrars)
    .set({ name, website, description })
    .where(eq(registrars.id, registrarId))
  revalidatePath("/admin/registrars")
  revalidatePath("/", "layout")
}

/** 保存站点设置(标题/描述/Logo/图标/页脚),保存后即时生效 */
export async function updateSiteSettings(
  _prevState: { ok?: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  await requireAdmin()
  const str = (k: string) => String(formData.get(k) ?? "").trim()

  const brandTextMain = str("brandTextMain")
  if (!brandTextMain) return { error: "品牌主体文字为必填项" }

  try {
    const values = {
      brandTextMain,
      brandTextAccent: str("brandTextAccent"),
      brandSuffix: str("brandSuffix"),
      logoUrl: str("logoUrl") || null,
      faviconUrl: str("faviconUrl") || null,
      titleZh: str("titleZh"),
      titleEn: str("titleEn"),
      descriptionZh: str("descriptionZh"),
      descriptionEn: str("descriptionEn"),
      footerDisclaimerZh: str("footerDisclaimerZh"),
      footerDisclaimerEn: str("footerDisclaimerEn"),
      updatedAt: new Date(),
    }
    await db
      .insert(siteSettings)
      .values({ id: 1, ...values })
      .onConflictDoUpdate({ target: siteSettings.id, set: values })

    invalidateSiteSettings()
    revalidatePath("/", "layout")
    revalidatePath("/admin/settings")
    return { ok: true }
  } catch (error) {
    console.error("[v0] 保存站点设置失败:", error)
    return { error: "保存失败，请重试" }
  }
}
