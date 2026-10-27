"use server"

import { db } from "@/lib/db"
import { registrars, siteSettings, adSlots } from "@/lib/db/schema"
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
import { invalidateAds } from "@/lib/ads"
import { ALL_AD_POSITIONS } from "@/lib/ad-positions"
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

/** 新建广告位 */
export async function createAd(
  _prevState: { ok?: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  await requireAdmin()
  const str = (k: string) => String(formData.get(k) ?? "").trim()

  const position = str("position")
  const type = str("type") || "text"
  const linkUrl = str("linkUrl")

  if (!position) return { error: "投放位置为必填项" }

  try {
    await db.insert(adSlots).values({
      position,
      type,
      titleZh: str("titleZh"),
      titleEn: str("titleEn"),
      subtitleZh: str("subtitleZh"),
      subtitleEn: str("subtitleEn"),
      imageUrl: str("imageUrl") || null,
      imageAlt: str("imageAlt") || null,
      linkUrl,
      openInNewTab: formData.get("openInNewTab") !== "false",
      rel: str("rel") || "sponsored noopener",
      weight: Number(formData.get("weight") ?? 1) || 1,
      isActive: formData.get("isActive") !== "false",
      startsAt: str("startsAt") ? new Date(str("startsAt")) : null,
      endsAt: str("endsAt") ? new Date(str("endsAt")) : null,
    })
    invalidateAds()
    revalidatePath("/admin/ads")
    return { ok: true }
  } catch (error) {
    console.error("[v0] 创建广告失败:", error)
    return { error: "创建失败，请重试" }
  }
}

/** 更新广告位 */
export async function updateAd(
  _prevState: { ok?: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  await requireAdmin()
  const str = (k: string) => String(formData.get(k) ?? "").trim()
  const id = Number(formData.get("id"))
  if (!id) return { error: "缺少广告 ID" }

  const position = str("position")
  if (!position) return { error: "投放位置为必填项" }

  try {
    await db
      .update(adSlots)
      .set({
        position,
        type: str("type") || "text",
        titleZh: str("titleZh"),
        titleEn: str("titleEn"),
        subtitleZh: str("subtitleZh"),
        subtitleEn: str("subtitleEn"),
        imageUrl: str("imageUrl") || null,
        imageAlt: str("imageAlt") || null,
        linkUrl: str("linkUrl"),
        openInNewTab: formData.get("openInNewTab") !== "false",
        rel: str("rel") || "sponsored noopener",
        weight: Number(formData.get("weight") ?? 1) || 1,
        isActive: formData.get("isActive") !== "false",
        startsAt: str("startsAt") ? new Date(str("startsAt")) : null,
        endsAt: str("endsAt") ? new Date(str("endsAt")) : null,
        updatedAt: new Date(),
      })
      .where(eq(adSlots.id, id))
    invalidateAds()
    revalidatePath("/admin/ads")
    return { ok: true }
  } catch (error) {
    console.error("[v0] 更新广告失败:", error)
    return { error: "更新失败，请重试" }
  }
}

/** 删除广告位 */
export async function deleteAd(id: number) {
  await requireAdmin()
  try {
    await db.delete(adSlots).where(eq(adSlots.id, id))
    invalidateAds()
    revalidatePath("/admin/ads")
  } catch (error) {
    console.error("[v0] 删除广告失败:", error)
  }
}

/** 切换广告启用状态 */
export async function toggleAdActive(id: number, isActive: boolean) {
  await requireAdmin()
  try {
    await db.update(adSlots).set({ isActive, updatedAt: new Date() }).where(eq(adSlots.id, id))
    invalidateAds()
    revalidatePath("/admin/ads")
  } catch (error) {
    console.error("[v0] 切换广告状态失败:", error)
  }
}

/**
 * 切换某广告位置的启用/禁用。
 * 存储到 site_settings.ad_positions_enabled (jsonb 数)。
 * null = 全部启用；有值 = 仅数组中的位置启用。
 */
export async function toggleAdPosition(position: string, enabled: boolean) {
  await requireAdmin()
  try {
    const [row] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1)
    const current: string[] | null = (row?.adPositionsEnabled as string[] | null) ?? null

    let next: string[] | null
    if (current === null) {
      // 当前全部启用 → 禁用某个位置 = 列出除它以外全部
      next = enabled ? null : ALL_AD_POSITIONS.filter((p) => p !== position)
    } else {
      if (enabled) {
        // 恢复某位置 → 如果全部都在列表里了，回到 null（全部启用）
        const added = current.includes(position) ? current : [...current, position]
        next = ALL_AD_POSITIONS.every((p) => added.includes(p)) ? null : added
      } else {
        next = current.filter((p) => p !== position)
      }
    }

    await db
      .update(siteSettings)
      .set({ adPositionsEnabled: next as string[] | null, updatedAt: new Date() })
      .where(eq(siteSettings.id, 1))

    invalidateSiteSettings()
    invalidateAds()
    revalidatePath("/admin/ads")
  } catch (error) {
    console.error("[v0] 切换广告位置失败:", error)
  }
}
