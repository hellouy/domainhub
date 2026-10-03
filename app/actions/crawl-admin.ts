"use server"

import { asc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { adapterRules, registrars } from "@/lib/db/schema"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { runCrawlJob } from "@/lib/crawler/runner"
import { scanPricePage } from "@/services/price-scanner"

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) throw new Error("未授权")
}

function revalidateRegistrar() {
  revalidatePath("/admin/registrars")
  revalidatePath("/admin/adapter-rules")
  revalidatePath("/admin/crawls")
  revalidatePath("/", "layout")
}

/** 把多行/逗号分隔文本解析为去重后的 URL 列表(仅保留 http/https) */
function parseUrls(text: string): string[] {
  const list = text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((u) => /^https?:\/\//i.test(u))
  return [...new Set(list)].slice(0, 5)
}

/** 生成唯一 slug */
async function uniqueSlug(name: string, website: string): Promise<string> {
  let host = ""
  try {
    host = new URL(website).hostname
  } catch {
    host = website
  }
  let base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  if (!base || base.length < 2) {
    base = host.replace(/^www\./, "").split(".")[0].replace(/[^a-z0-9]+/g, "-")
  }
  base = base.slice(0, 40) || "registrar"

  const existing = await db.select({ slug: registrars.slug }).from(registrars)
  const taken = new Set(existing.map((r) => r.slug))
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}

// ============================================================
// 手动新建注册商 + 采集地址
// ============================================================

/** 手动新建注册商(默认未启用,待生成并激活规则后再启用采集) */
export async function createRegistrar(
  _prev: { ok?: boolean; message?: string; registrarId?: number } | null,
  formData: FormData,
): Promise<{ ok?: boolean; message?: string; registrarId?: number }> {
  await requireAdmin()
  const name = String(formData.get("name") ?? "").trim()
  const website = String(formData.get("website") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  const crawlUrls = parseUrls(String(formData.get("crawlUrls") ?? ""))

  if (!name) return { ok: false, message: "名称为必填项" }
  if (!/^https?:\/\//i.test(website)) return { ok: false, message: "官网地址须以 http(s):// 开头" }

  try {
    const slug = await uniqueSlug(name, website)
    const [reg] = await db
      .insert(registrars)
      .values({
        slug,
        name,
        website,
        description,
        crawlUrls: crawlUrls.length ? crawlUrls : null,
        isActive: false,
        status: "discovered",
        owner: "手动添加",
        priority: 60,
      })
      .returning({ id: registrars.id })
    revalidateRegistrar()
    return { ok: true, message: `已创建「${name}」(slug: ${slug})`, registrarId: reg.id }
  } catch (error) {
    console.error("[v0] 新建注册商失败:", error)
    return { ok: false, message: "创建失败,请重试" }
  }
}

/** 保存/更新某注册商的采集地址(价格页 URL 列表) */
export async function saveCrawlUrls(registrarId: number, urlsText: string) {
  await requireAdmin()
  const urls = parseUrls(urlsText)
  await db
    .update(registrars)
    .set({ crawlUrls: urls.length ? urls : null })
    .where(eq(registrars.id, registrarId))
  revalidateRegistrar()
  return { ok: true, message: urls.length ? `已保存 ${urls.length} 个采集地址` : "已清空采集地址", urls }
}

// ============================================================
// 扫描 / AI 修复 / 试采集
// ============================================================

/** 扫描单个 URL,返回各策略信号与建议策略(用于诊断该地址能否采集、用什么策略) */
export async function scanUrl(url: string) {
  await requireAdmin()
  const trimmed = url.trim()
  if (!/^https?:\/\//i.test(trimmed)) return { ok: false, message: "请输入有效的 http(s) 地址" }
  const scan = await scanPricePage(trimmed)
  return {
    ok: scan.ok,
    message: scan.message,
    status: scan.status,
    suggestedStrategy: scan.suggestedStrategy,
    signals: scan.signals,
    endpoints: scan.endpoints,
  }
}

/**
 * 对某注册商运行一轮 AI 修复:用其采集地址(crawlUrls,缺省回退官网)
 * 调用修复代理分析页面 → 产出并验证声明式规则 → 通过则激活。
 * 这是"AI 自动识别问题并修复"的入口。
 */
export async function repairRegistrar(registrarId: number) {
  await requireAdmin()
  const [reg] = await db.select().from(registrars).where(eq(registrars.id, registrarId))
  if (!reg) return { ok: false, message: "注册商不存在" }

  const urls = (reg.crawlUrls && reg.crawlUrls.length ? reg.crawlUrls : [reg.website]).slice(0, 3)
  if (urls.length === 0) return { ok: false, message: "请先填写采集地址" }

  const { repairAdapter } = await import("@/packages/ai-repair")
  const result = await repairAdapter(reg.slug, urls)
  revalidateRegistrar()
  return {
    ok: result.ok,
    message: result.message,
    modelUsed: result.modelUsed,
    parsedCount: result.parsedCount,
  }
}

/** 试采集:立即对该注册商跑一次采集任务,返回成败与统计(供后台诊断) */
export async function testCrawlRegistrar(registrarId: number) {
  await requireAdmin()
  const result = await runCrawlJob(registrarId)
  revalidateRegistrar()
  return {
    ok: result.ok,
    message: result.message,
    jobId: result.jobId,
    totalTlds: result.totalTlds,
    updated: result.updated,
    error: result.error,
  }
}

/** 读取某注册商的采集接入状态(采集地址 + 当前生效规则),供接入对话框初始化 */
export async function getRegistrarOnboarding(registrarId: number) {
  await requireAdmin()
  const [reg] = await db.select().from(registrars).where(eq(registrars.id, registrarId))
  if (!reg) return null
  const rules = await db
    .select({
      id: adapterRules.id,
      status: adapterRules.status,
      modelUsed: adapterRules.modelUsed,
      verification: adapterRules.verification,
      createdAt: adapterRules.createdAt,
    })
    .from(adapterRules)
    .where(eq(adapterRules.registrarId, registrarId))
    .orderBy(asc(adapterRules.createdAt))
  const active = rules.filter((r) => r.status === "active")
  return {
    crawlUrls: reg.crawlUrls ?? [],
    website: reg.website,
    hasActiveRule: active.length > 0,
    activeRule: active[active.length - 1] ?? null,
    ruleCount: rules.length,
  }
}
