/**
 * LLM 修复代理(Repair Agent)
 * ------------------------------------------------------------
 * 所有权: Platform Team
 *
 * 流程(与 docs/architecture.md 的自愈闭环对应):
 *   1. 抓取注册商价格页快照(含候选 URL 探测)
 *   2. 沿多模型回退链分析页面 → 产出声明式配置(DynamicRule)
 *   3. 确定性验证: 用产出的配置真实解析页面,检查解析条数与样本合理性
 *   4. 通过 → 写入 adapter_rules(status=active,旧规则 superseded)
 *      不通过 → 写入 status=rejected,标记人工处理
 *
 * LLM 只在"接入/修复"时被调用;日常采集读取已生成的静态规则,零 LLM 成本。
 */

import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { adapterRules, registrars } from "@/lib/db/schema"
import { extractTableRows, findTldCell, parsePrice } from "@/adapters/shared/table-adapter"
import { generateWithFallback } from "./model-chain"
import { dynamicRuleSchema, type DynamicRule, type RuleVerification } from "./schema"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

/** 单页快照上限(字符),超出截断——Gemini Flash 上下文足够大,但控制成本 */
const SNAPSHOT_LIMIT = 150_000

export interface RepairResult {
  ok: boolean
  slug: string
  modelUsed?: string
  ruleId?: number
  parsedCount?: number
  message: string
  attempts?: { model: string; ok: boolean; error?: string }[]
}

/** 抓取页面快照,失败返回 null */
async function snapshot(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return null
    const text = await res.text()
    return text.length > SNAPSHOT_LIMIT ? text.slice(0, SNAPSHOT_LIMIT) : text
  } catch {
    return null
  }
}

/** 用 LLM 产出的配置对快照做真实解析,返回验证结果(确定性,无 LLM 参与) */
export function verifyRule(html: string, rule: DynamicRule): RuleVerification {
  const rows = extractTableRows(html)
  const samples: RuleVerification["samplePrices"] = []
  const tlds: string[] = []
  const seen = new Set<string>()

  for (const cells of rows) {
    const hit = findTldCell(cells)
    if (!hit) continue
    const [tld, tldIdx] = hit
    if (seen.has(tld)) continue
    const values: (number | null)[] = []
    for (let i = tldIdx + 1; i < cells.length; i++) values.push(parsePrice(cells[i], rule.numberFormat))
    if (values.every((v) => v === null)) continue
    seen.add(tld)
    tlds.push(tld)
    if (samples.length < 5) {
      let register: number | null = null
      let renew: number | null = null
      let vi = 0
      for (const role of rule.columnOrder) {
        if (vi >= values.length) break
        const v = values[vi]
        vi++
        if (role === "register") register = v
        else if (role === "renew") renew = v
      }
      samples.push({ tld, register, renew })
    }
  }

  const parsedCount = tlds.length
  // 验收标准: 至少 10 个 TLD,且样本中至少一条有注册价
  const passed = parsedCount >= 10 && samples.some((s) => s.register !== null)
  return {
    parsedCount,
    sampleTlds: tlds.slice(0, 20),
    samplePrices: samples,
    passed,
    reason: passed ? undefined : `解析出 ${parsedCount} 个 TLD(最低要求 10),或样本无有效注册价`,
  }
}

/**
 * 对指定注册商执行一轮 LLM 修复。
 * candidateUrls: 供模型选择的候选价格页(来自 discovery_metadata / 人工提供 / 历史配置)
 */
export async function repairAdapter(slug: string, candidateUrls: string[]): Promise<RepairResult> {
  const [reg] = await db.select().from(registrars).where(eq(registrars.slug, slug))
  if (!reg) return { ok: false, slug, message: `注册商 ${slug} 不存在` }

  // 1. 抓取候选页面快照
  const snapshots: { url: string; html: string }[] = []
  for (const url of candidateUrls.slice(0, 3)) {
    const html = await snapshot(url)
    if (html && /<tr|<table/i.test(html)) snapshots.push({ url, html })
  }
  if (snapshots.length === 0) {
    return { ok: false, slug, message: "所有候选 URL 均无法抓取或不含表格(可能被反爬拦截,需代理或官方 API)" }
  }

  // 2. 沿模型链分析(取表格密度最高的快照)
  const best = snapshots.sort(
    (a, b) => (b.html.match(/<tr/gi)?.length ?? 0) - (a.html.match(/<tr/gi)?.length ?? 0),
  )[0]

  let chain
  try {
    chain = await generateWithFallback({
      schema: dynamicRuleSchema,
      system: [
        "你是域名注册商价格页结构分析器。给你一段价格页 HTML,你输出一份声明式解析配置。",
        "规则:",
        "1. urls 只能从提供的候选列表中选择,禁止编造 URL。",
        "2. columnOrder 描述 TLD 列之后各价格列的语义(register=注册价/首年价, renew=续费价, transfer=转入价, restore=赎回价, skip=非价格列)。",
        "3. 仔细观察数字格式: 1,234.56 是 en;1.234,56 是 eu;1 234,56 是 fr。",
        "4. currency 是页面显示价格的货币(看货币符号: $ € £ kr CHF 円 等)。",
        "5. 不确定时降低 confidence,不要猜测。",
      ].join("\n"),
      prompt: [
        `注册商: ${reg.name} (${slug})`,
        `候选 URL 列表: ${JSON.stringify(candidateUrls)}`,
        `以下是 ${best.url} 的 HTML 快照(可能截断):`,
        "```html",
        best.html,
        "```",
      ].join("\n"),
    })
  } catch (error) {
    return {
      ok: false,
      slug,
      message: `模型链全部失败: ${error instanceof Error ? error.message.slice(0, 300) : "未知错误"}`,
    }
  }

  const rule = chain.output

  // 3. 确定性验证(LLM 无权直接入库)
  const verification = verifyRule(best.html, rule)

  // 4. 写入规则表
  if (verification.passed) {
    // 旧 active 规则标记 superseded
    await db
      .update(adapterRules)
      .set({ status: "superseded" })
      .where(and(eq(adapterRules.registrarId, reg.id), eq(adapterRules.status, "active")))
    const [row] = await db
      .insert(adapterRules)
      .values({
        registrarId: reg.id,
        config: rule,
        status: "active",
        modelUsed: chain.modelUsed,
        verification,
        trigger: "repair",
      })
      .returning({ id: adapterRules.id })
    return {
      ok: true,
      slug,
      modelUsed: chain.modelUsed,
      ruleId: row.id,
      parsedCount: verification.parsedCount,
      message: `修复成功: ${chain.modelUsed} 产出规则解析到 ${verification.parsedCount} 个 TLD,已激活`,
      attempts: chain.attempts,
    }
  }

  await db.insert(adapterRules).values({
    registrarId: reg.id,
    config: rule,
    status: "rejected",
    modelUsed: chain.modelUsed,
    verification,
    trigger: "repair",
  })
  return {
    ok: false,
    slug,
    modelUsed: chain.modelUsed,
    parsedCount: verification.parsedCount,
    message: `规则验证未通过: ${verification.reason},已标记人工处理`,
    attempts: chain.attempts,
  }
}

/** 按 slug 读取当前生效的动态规则(表格适配器工厂在 fetch 时调用) */
export async function getActiveRuleBySlug(slug: string): Promise<DynamicRule | null> {
  const [reg] = await db.select({ id: registrars.id }).from(registrars).where(eq(registrars.slug, slug))
  if (!reg) return null
  return getActiveRule(reg.id)
}

/** 读取注册商当前生效的动态规则(采集运行时调用,零 LLM 成本) */
export async function getActiveRule(registrarId: number): Promise<DynamicRule | null> {
  const [row] = await db
    .select({ config: adapterRules.config })
    .from(adapterRules)
    .where(and(eq(adapterRules.registrarId, registrarId), eq(adapterRules.status, "active")))
    .orderBy(adapterRules.createdAt)
    .limit(1)
  if (!row) return null
  const parsed = dynamicRuleSchema.safeParse(row.config)
  return parsed.success ? parsed.data : null
}
