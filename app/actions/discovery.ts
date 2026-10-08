"use server"

import { and, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { adapterRules, registrarCandidates, registrars } from "@/lib/db/schema"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { discoverAndSave, discoverBatch } from "@/services/registrar-discovery"
import { scanPricePage } from "@/services/price-scanner"

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) throw new Error("未授权")
}

function revalidateDiscovery() {
  revalidatePath("/admin/discovery")
  revalidatePath("/admin/adapter-rules")
  revalidatePath("/admin/registrars")
}

// ============================================================
// 发现
// ============================================================

/** 发现单个 URL 并落库为候选 */
export async function runDiscovery(url: string) {
  await requireAdmin()
  const trimmed = url.trim()
  if (!trimmed) return { ok: false, message: "请输入 URL" }
  const result = await discoverAndSave(trimmed, "manual")
  revalidateDiscovery()
  return result
}

/** 批量发现:文本框内每行一个 URL */
export async function runDiscoveryBatch(urlsText: string) {
  await requireAdmin()
  const urls = urlsText
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (urls.length === 0) return { ok: false, message: "请输入至少一个 URL", results: [] }
  if (urls.length > 30) return { ok: false, message: "单次最多 30 个 URL", results: [] }
  const results = await discoverBatch(urls, "seed")
  revalidateDiscovery()
  const okCount = results.filter((r) => r.ok).length
  return { ok: true, message: `完成:${okCount}/${results.length} 个成功`, results }
}

/** 对候选的价格页运行策略扫描,写回 evidence.scan */
export async function scanCandidate(candidateId: number) {
  await requireAdmin()
  const [c] = await db.select().from(registrarCandidates).where(eq(registrarCandidates.id, candidateId))
  if (!c) return { ok: false, message: "候选不存在" }
  const target = c.pricePage ?? c.website
  const scan = await scanPricePage(target)
  const evidence = { ...(c.evidence as Record<string, unknown> | null), scan }
  await db
    .update(registrarCandidates)
    .set({ evidence, updatedAt: new Date() })
    .where(eq(registrarCandidates.id, candidateId))
  revalidateDiscovery()
  return { ok: scan.ok, message: scan.message, suggestedStrategy: scan.suggestedStrategy }
}

// ============================================================
// 审核
// ============================================================

/** 生成唯一 slug */
function slugify(input: string, host: string): string {
  let base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  if (!base || base.length < 2) {
    base = host.replace(/^www\./, "").split(".")[0].replace(/[^a-z0-9]+/g, "-")
  }
  return base.slice(0, 40) || "registrar"
}

async function uniqueSlug(candidateSlug: string): Promise<string> {
  const existing = await db.select({ slug: registrars.slug }).from(registrars)
  const taken = new Set(existing.map((r) => r.slug))
  if (!taken.has(candidateSlug)) return candidateSlug
  let i = 2
  while (taken.has(`${candidateSlug}-${i}`)) i++
  return `${candidateSlug}-${i}`
}

/**
 * 审核通过:把候选提升为正式注册商(status=discovered,isActive=false,
 * 待生成并激活规则后再由管理员启用)。回填 candidate.promotedRegistrarId。
 */
export async function approveCandidate(candidateId: number) {
  await requireAdmin()
  const [c] = await db.select().from(registrarCandidates).where(eq(registrarCandidates.id, candidateId))
  if (!c) return { ok: false, message: "候选不存在" }
  if (c.status === "promoted" && c.promotedRegistrarId) {
    return { ok: false, message: "该候选已提升为正式注册商" }
  }

  let host = ""
  try {
    host = new URL(c.website).hostname
  } catch {
    host = c.website
  }
  const slug = await uniqueSlug(slugify(c.name, host))

  const [reg] = await db
    .insert(registrars)
    .values({
      slug,
      name: c.name || slug,
      website: c.website,
      description: "",
      isActive: false,
      status: "discovered",
      owner: "AI Discovery",
      priority: 60,
    })
    .returning({ id: registrars.id, slug: registrars.slug })

  await db
    .update(registrarCandidates)
    .set({ status: "promoted", promotedRegistrarId: reg.id, updatedAt: new Date() })
    .where(eq(registrarCandidates.id, candidateId))

  revalidateDiscovery()
  return { ok: true, message: `已创建注册商「${c.name}」(slug: ${reg.slug}),下一步生成采集规则`, registrarId: reg.id, slug: reg.slug }
}

/** 拒绝候选 */
export async function rejectCandidate(candidateId: number) {
  await requireAdmin()
  await db
    .update(registrarCandidates)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(eq(registrarCandidates.id, candidateId))
  revalidateDiscovery()
  return { ok: true, message: "已拒绝" }
}

/** 删除候选 */
export async function deleteCandidate(candidateId: number) {
  await requireAdmin()
  await db.delete(registrarCandidates).where(eq(registrarCandidates.id, candidateId))
  revalidateDiscovery()
  return { ok: true, message: "已删除" }
}

// ============================================================
// 适配器规则(adapter_rules)
// ============================================================

/**
 * 为某注册商生成采集规则(调用 AI 修复代理)。
 * candidateUrls 缺省时用该注册商的价格页候选(discovery/pricePage/website)。
 */
export async function generateRule(slug: string, candidateUrlsText?: string) {
  await requireAdmin()
  const [reg] = await db.select().from(registrars).where(eq(registrars.slug, slug))
  if (!reg) return { ok: false, message: `注册商 ${slug} 不存在` }

  let urls: string[] = []
  if (candidateUrlsText && candidateUrlsText.trim()) {
    urls = candidateUrlsText.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
  } else {
    // 从候选池找对应 website 的 pricePage
    const [cand] = await db
      .select()
      .from(registrarCandidates)
      .where(eq(registrarCandidates.promotedRegistrarId, reg.id))
      .limit(1)
    if (cand?.pricePage) urls.push(cand.pricePage)
    urls.push(reg.website)
  }
  urls = [...new Set(urls)].slice(0, 3)
  if (urls.length === 0) return { ok: false, message: "没有可用的候选 URL" }

  // 动态导入以避免把 AI 依赖打进无关 bundle
  const { repairAdapter } = await import("@/packages/ai-repair")
  const result = await repairAdapter(slug, urls)
  revalidateDiscovery()
  revalidatePath("/admin/adapter-rules")
  return { ok: result.ok, message: result.message }
}

/** 激活某条规则(其余 active 置 superseded) */
export async function activateRule(ruleId: number) {
  await requireAdmin()
  const [rule] = await db.select().from(adapterRules).where(eq(adapterRules.id, ruleId))
  if (!rule) return { ok: false, message: "规则不存在" }
  await db
    .update(adapterRules)
    .set({ status: "superseded" })
    .where(and(eq(adapterRules.registrarId, rule.registrarId), eq(adapterRules.status, "active")))
  await db.update(adapterRules).set({ status: "active" }).where(eq(adapterRules.id, ruleId))
  revalidatePath("/admin/adapter-rules")
  return { ok: true, message: "规则已激活" }
}

/** 禁用/拒绝某条规则 */
export async function rejectRule(ruleId: number) {
  await requireAdmin()
  await db.update(adapterRules).set({ status: "rejected" }).where(eq(adapterRules.id, ruleId))
  revalidatePath("/admin/adapter-rules")
  return { ok: true, message: "规则已禁用" }
}

/** 启用/停用注册商(供发现流程收尾:规则激活后启用采集) */
export async function setRegistrarActive(registrarId: number, isActive: boolean) {
  await requireAdmin()
  await db
    .update(registrars)
    .set({ isActive, status: isActive ? "active" : "paused" })
    .where(eq(registrars.id, registrarId))
  revalidatePath("/admin/adapter-rules")
  revalidatePath("/admin/registrars")
  revalidatePath("/", "layout")
  return { ok: true, message: isActive ? "已启用采集" : "已停用采集" }
}

/** 读取全部规则(含注册商名),供 adapter-rules 页面 */
export async function listAdapterRulesData() {
  const rows = await db
    .select({
      id: adapterRules.id,
      registrarId: adapterRules.registrarId,
      slug: registrars.slug,
      registrarName: registrars.name,
      isActive: registrars.isActive,
      config: adapterRules.config,
      status: adapterRules.status,
      modelUsed: adapterRules.modelUsed,
      verification: adapterRules.verification,
      trigger: adapterRules.trigger,
      createdAt: adapterRules.createdAt,
    })
    .from(adapterRules)
    .leftJoin(registrars, eq(adapterRules.registrarId, registrars.id))
    .orderBy(desc(adapterRules.createdAt))
  return rows
}
