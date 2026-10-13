"use server"

import { db } from "@/lib/db"
import { registrars, siteSettings } from "@/lib/db/schema"
import {
  clearAdminLoginFailures,
  createAdminSession,
  destroyAdminSession,
  isAdminAuthenticated,
  isAdminLoginBlocked,
  recordAdminLoginFailure,
  verifyPassword,
} from "@/lib/admin-auth"
import { runCrawlJob } from "@/lib/crawler/runner"
import { invalidateSiteSettings } from "@/lib/site-settings"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { getQueue } from "@/packages/queue"
import { drainQueue } from "@/packages/scheduler"

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) throw new Error("未授权")
}

export async function adminLogin(_prevState: { error?: string } | null, formData: FormData) {
  const password = String(formData.get("password") ?? "")
  let clientIp = "unknown"
  try {
    const requestHeaders = await headers()
    const forwardedFor =
      requestHeaders.get("x-vercel-forwarded-for") ??
      requestHeaders.get("x-real-ip") ??
      requestHeaders.get("x-forwarded-for")
    clientIp = forwardedFor?.split(",")[0]?.trim().slice(0, 128) || "unknown"

    if (await isAdminLoginBlocked(clientIp)) {
      return { error: "登录失败次数过多，请 15 分钟后重试" }
    }
    if (!password || !verifyPassword(password)) {
      await recordAdminLoginFailure(clientIp)
      return { error: "密码错误，请重试" }
    }
    await clearAdminLoginFailures(clientIp)
  } catch (error) {
    console.error("[auth] 管理员登录验证失败:", error)
    return { error: "登录服务暂时不可用，请稍后重试" }
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
  const [registrar] = await db
    .select({ id: registrars.id, priority: registrars.priority })
    .from(registrars)
    .where(eq(registrars.id, registrarId))
    .limit(1)
  if (!registrar) throw new Error("注册商不存在")
  await getQueue().enqueue({
    registrarId: registrar.id,
    priority: registrar.priority ?? 100,
    trigger: "manual",
  })
  const result = await drainQueue(
    async (id) => {
      const res = await runCrawlJob(id)
      return { ok: res.ok, error: res.error }
    },
    { maxJobs: 1, budgetMs: 14_000, targetRegistrarId: registrar.id },
  )
  revalidatePath("/admin")
  revalidatePath("/admin/crawls")
  revalidatePath("/", "layout")
  if (result.processed === 0) {
    return {
      jobId: 0,
      ok: false,
      message: "该注册商已有任务在队列中排队，将在后台依次执行",
      totalTlds: 0,
      updated: 0,
      skipped: 0,
      durationMs: 0,
      error: "队列繁忙，任务已排队待执行",
    }
  }
  return {
    jobId: 0,
    ok: true,
    message:
      result.succeeded > 0
        ? `采集完成：成功 ${result.succeeded} 家`
        : "任务已开始执行，结果请到「采集任务」查看",
    totalTlds: 0,
    updated: 0,
    skipped: 0,
    durationMs: 0,
  }
}

export async function triggerCrawlAll() {
  await requireAdmin()
  const active = await db.select().from(registrars).where(eq(registrars.isActive, true))
  const queue = getQueue()
  for (const r of active) {
    await queue.enqueue({ registrarId: r.id, priority: r.priority ?? 100, trigger: "manual" })
  }
  const result = await drainQueue(
    async (id) => {
      const res = await runCrawlJob(id)
      return { ok: res.ok, error: res.error }
    },
    { maxJobs: 4, budgetMs: 12_000 },
  )
  const pending = await queue.pendingCount()
  revalidatePath("/admin")
  revalidatePath("/admin/crawls")
  revalidatePath("/", "layout")
  return Array.from({ length: 1 }, () => ({
    jobId: 0,
    ok: true,
    message: `已入队 ${active.length} 家注册商；本次完成 ${result.processed} 家，队列中还有 ${pending} 家待执行`,
    totalTlds: 0,
    updated: 0,
    skipped: 0,
    durationMs: 0,
  }))
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
