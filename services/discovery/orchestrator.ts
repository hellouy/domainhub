/**
 * Discovery Orchestrator —— 发现全流程编排
 * ------------------------------------------------------------
 * 所有权: Platform Team
 *
 * 串联: 发现(discoverBatch) → 高信心候选自动提升为注册商 → AI 生成采集规则(repairAdapter)
 *
 * 供每日 cron(/api/cron/discovery)调用。运行在服务端上下文(无 requireAdmin),
 * 因此直接调用底层 service，不经过 app/actions 的鉴权包装。
 *
 * 设计原则:
 *   - 仅"自动提升"高信心候选(默认 confidence >= autoPromoteThreshold),
 *     其余留在候选池等人工审核 → 避免污染正式注册商表。
 *   - 自动提升的注册商 isActive=false、status='discovered',
 *     规则生成成功后仍需人工在后台激活规则并启用注册商 → 双重把关。
 *   - 全程幂等: 重复发现按 website 去重; 已提升的候选不会重复建注册商。
 */

import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { registrarCandidates, registrars } from "@/lib/db/schema"
import { discoverBatch } from "@/services/registrar-discovery"

export interface OrchestrateOptions {
  /** 自动提升为注册商的最低信心分(0-100),默认 70 */
  autoPromoteThreshold?: number
  /** 是否在提升后自动尝试用 AI 生成采集规则,默认 true */
  autoGenerateRule?: boolean
  /** 时间预算(毫秒),超出后停止处理剩余候选,默认 240s */
  budgetMs?: number
}

export interface OrchestrateResult {
  discovered: number
  promoted: number
  rulesGenerated: number
  ruleFailures: number
  skipped: number
  details: {
    website: string
    confidence?: number
    action: "promoted" | "kept-pending" | "already" | "rule-ok" | "rule-failed"
    message: string
  }[]
}

/** slug 化(与 discovery actions 内一致的简化实现) */
function slugify(name: string, hostFallback: string): string {
  let base = (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  if (!base || base.length < 2) {
    base = hostFallback.replace(/^www\./, "").split(".")[0]
  }
  return base.slice(0, 40) || "registrar"
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base
  let n = 1
  // 最多尝试若干次,避免极端并发死循环
  while (n < 50) {
    const [existing] = await db.select({ id: registrars.id }).from(registrars).where(eq(registrars.slug, candidate)).limit(1)
    if (!existing) return candidate
    n += 1
    candidate = `${base}-${n}`
  }
  return `${base}-${Date.now()}`
}

/**
 * 编排入口。
 * @param urls 待发现的注册商 URL 列表(cron 从种子/IANA/已知站点提供)
 */
export async function orchestrateDiscovery(
  urls: string[],
  options: OrchestrateOptions = {},
): Promise<OrchestrateResult> {
  const { autoPromoteThreshold = 70, autoGenerateRule = true, budgetMs = 240_000 } = options
  const startedAt = Date.now()

  const result: OrchestrateResult = {
    discovered: 0,
    promoted: 0,
    rulesGenerated: 0,
    ruleFailures: 0,
    skipped: 0,
    details: [],
  }

  if (urls.length === 0) return result

  // 1. 发现(去重、落候选池)
  const discovered = await discoverBatch(urls, "seed")
  result.discovered = discovered.filter((d) => d.ok).length

  // 2. 逐个处理 pending 且信心达标的候选
  for (const d of discovered) {
    if (Date.now() - startedAt > budgetMs) {
      result.skipped += 1
      continue
    }
    if (!d.ok) {
      result.details.push({ website: d.url, confidence: d.confidence, action: "kept-pending", message: d.message })
      continue
    }

    const [cand] = await db.select().from(registrarCandidates).where(eq(registrarCandidates.website, normalizeWebsite(d.url))).limit(1)
    // discoverAndSave 用归一化后的 website 存储,这里按 website 反查;找不到就跳过
    const candidate = cand ?? (await findCandidateByLooseUrl(d.url))
    if (!candidate) {
      result.details.push({ website: d.url, confidence: d.confidence, action: "kept-pending", message: "候选未找到(可能已存在)" })
      continue
    }

    // 已提升/已审核的不再处理
    if (candidate.status === "promoted" && candidate.promotedRegistrarId) {
      result.details.push({ website: candidate.website, confidence: candidate.confidence, action: "already", message: "已是正式注册商" })
      continue
    }
    if (candidate.status === "rejected") {
      result.details.push({ website: candidate.website, confidence: candidate.confidence, action: "kept-pending", message: "此前已被拒绝,跳过" })
      continue
    }

    // 信心不足 → 留待人工审核
    if (candidate.confidence < autoPromoteThreshold) {
      result.details.push({
        website: candidate.website,
        confidence: candidate.confidence,
        action: "kept-pending",
        message: `信心分 ${candidate.confidence} < 阈值 ${autoPromoteThreshold},留待人工审核`,
      })
      continue
    }

    // 3. 自动提升为注册商(isActive=false,需人工启用)
    let host = ""
    try {
      host = new URL(candidate.website).hostname
    } catch {
      host = candidate.website
    }
    const slug = await uniqueSlug(slugify(candidate.name, host))

    const [reg] = await db
      .insert(registrars)
      .values({
        slug,
        name: candidate.name || slug,
        website: candidate.website,
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
      .where(eq(registrarCandidates.id, candidate.id))

    result.promoted += 1
    result.details.push({
      website: candidate.website,
      confidence: candidate.confidence,
      action: "promoted",
      message: `提升为注册商 ${reg.slug}(未启用)`,
    })

    // 4. 自动生成采集规则(AI),失败不阻塞整体流程
    if (autoGenerateRule && (Date.now() - startedAt <= budgetMs)) {
      const urlsForRule = [...new Set([candidate.pricePage, candidate.website].filter(Boolean) as string[])].slice(0, 3)
      if (urlsForRule.length > 0) {
        try {
          const { repairAdapter } = await import("@/packages/ai-repair")
          const rr = await repairAdapter(reg.slug, urlsForRule)
          if (rr.ok) {
            result.rulesGenerated += 1
            result.details.push({
              website: candidate.website,
              action: "rule-ok",
              message: `规则已生成(模型 ${rr.modelUsed ?? "?"},样本 ${rr.parsedCount ?? 0} 条),需人工激活`,
            })
          } else {
            result.ruleFailures += 1
            result.details.push({ website: candidate.website, action: "rule-failed", message: rr.message })
          }
        } catch (error) {
          result.ruleFailures += 1
          result.details.push({
            website: candidate.website,
            action: "rule-failed",
            message: `规则生成异常: ${error instanceof Error ? error.message : String(error)}`,
          })
        }
      }
    }
  }

  return result
}

/** 归一化 website(与发现引擎保持一致的简化版:去尾斜杠) */
function normalizeWebsite(rawUrl: string): string {
  try {
    const u = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`)
    return `${u.protocol}//${u.hostname}`
  } catch {
    return rawUrl
  }
}

/** 按主机名宽松反查候选(发现引擎存的是主站 origin) */
async function findCandidateByLooseUrl(rawUrl: string) {
  let host = ""
  try {
    host = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`).hostname
  } catch {
    return null
  }
  const rows = await db.select().from(registrarCandidates)
  return rows.find((r) => {
    try {
      return new URL(r.website).hostname === host
    } catch {
      return false
    }
  }) ?? null
}
