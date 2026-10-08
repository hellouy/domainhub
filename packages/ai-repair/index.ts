/**
 * LLM 修复代理(Repair Agent)
 * ------------------------------------------------------------
 * 所有权: Platform Team
 *
 * 流程(与 docs/architecture.md 的自愈闭环对应):
 *   1. 抓取注册商价格页快照(含候选 URL 探测)
 *   2. 用 Price Scanner 确定性探测各候选页"用哪种策略能取到价格"
 *   3. 沿多模型回退链分析页面 + 扫描提示 → 产出声明式配置(DynamicRule)
 *   4. 确定性验证: 用产出的配置真实解析页面/数据端点,检查解析条数与样本合理性
 *   5. 通过 → 写入 adapter_rules(status=active,旧规则 superseded)
 *      不通过 → 写入 status=rejected,标记人工处理
 *
 * 支持多策略: html / hydration / nuxt-payload / embedded-json / json / api / playwright。
 * 页面无表格但含 JSON 价格数据时不再直接放弃(旧行为),而是交给对应策略处理。
 *
 * LLM 只在"接入/修复"时被调用;日常采集读取已生成的静态规则,零 LLM 成本。
 */

import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { adapterRules, registrars } from "@/lib/db/schema"
import { extractTableRows, findTldCell, parsePrice } from "@/adapters/shared/table-adapter"
import { parsePriceString } from "@/packages/parser"
import { scanPricePage, type ScanResult } from "@/services/price-scanner"
import { generateWithFallback } from "./model-chain"
import { dynamicRuleSchema, type DynamicRule, type RuleVerification } from "./schema"
import { extractPricesFromRaw, ruleStrategyOf } from "./extract"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

/** 单页快照上限(字符),超出截断——Gemini Flash 上下文足够大,但控制成本 */
const SNAPSHOT_LIMIT = 150_000
/** 数据端点抓取上限(JSON 可能较大) */
const DATA_LIMIT = 600_000
/** 验证通过的最低 TLD 条数 */
const MIN_TLDS = 10

const BROWSER_SERVICE_URL = process.env.BROWSER_SERVICE_URL ?? ""

export interface RepairResult {
  ok: boolean
  slug: string
  modelUsed?: string
  ruleId?: number
  parsedCount?: number
  strategy?: string
  message: string
  attempts?: { model: string; ok: boolean; error?: string }[]
}

/** 抓取文本(html 或 json),失败返回 null */
async function fetchText(url: string, limit: number): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/json" },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return null
    const text = await res.text()
    return text.length > limit ? text.slice(0, limit) : text
  } catch {
    return null
  }
}

const snapshot = (url: string) => fetchText(url, SNAPSHOT_LIMIT)

/** HTML 表格验证(同步,html 策略用) */
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
  const passed = parsedCount >= MIN_TLDS && samples.some((s) => s.register !== null)
  return {
    parsedCount,
    sampleTlds: tlds.slice(0, 20),
    samplePrices: samples,
    passed,
    strategy: "html",
    reason: passed ? undefined : `解析出 ${parsedCount} 个 TLD(最低要求 ${MIN_TLDS}),或样本无有效注册价`,
  }
}

/** 把 RawPrice[] 汇总成验证结果 */
function summarize(prices: { tld: string; registerPrice?: unknown; renewPrice?: unknown }[], strategy: string): RuleVerification {
  const seen = new Set<string>()
  const tlds: string[] = []
  const samples: RuleVerification["samplePrices"] = []
  for (const p of prices) {
    const tld = p.tld.toLowerCase().replace(/^\./, "")
    if (!tld || seen.has(tld)) continue
    seen.add(tld)
    tlds.push(tld)
    if (samples.length < 5) {
      samples.push({
        tld,
        register: parsePriceString(p.registerPrice as string),
        renew: parsePriceString(p.renewPrice as string),
      })
    }
  }
  const parsedCount = tlds.length
  const passed = parsedCount >= MIN_TLDS && samples.some((s) => s.register !== null)
  return {
    parsedCount,
    sampleTlds: tlds.slice(0, 20),
    samplePrices: samples,
    passed,
    strategy,
    reason: passed ? undefined : `解析出 ${parsedCount} 个 TLD(最低要求 ${MIN_TLDS}),或样本无有效注册价`,
  }
}

/** 通过浏览器服务渲染并抽取(playwright 策略验证用) */
async function browserExtract(rule: DynamicRule): Promise<RuleVerification> {
  if (!BROWSER_SERVICE_URL) {
    return {
      parsedCount: 0,
      sampleTlds: [],
      samplePrices: [],
      passed: false,
      strategy: "playwright",
      reason: "playwright 策略需部署浏览器服务(BROWSER_SERVICE_URL)后由采集实际验证,当前环境无法离线验证",
    }
  }
  try {
    const res = await fetch(`${BROWSER_SERVICE_URL}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        url: rule.dataUrl ?? rule.urls[0],
        extract: "extract-json",
        waitFor: rule.browser?.waitFor ?? null,
        scrollToBottom: rule.browser?.scrollToBottom ?? true,
        locale: rule.browser?.locale ?? null,
      }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) throw new Error(`浏览器服务 HTTP ${res.status}`)
    const data = (await res.json()) as { ok?: boolean; extracted?: Array<Record<string, unknown>>; error?: string }
    if (!data.ok) throw new Error(data.error ?? "浏览器服务渲染失败")
    const prices = (data.extracted ?? []).map((r) => ({
      tld: String(r.tld ?? ""),
      registerPrice: r.registerPrice,
      renewPrice: r.renewPrice,
    }))
    return summarize(prices, "playwright")
  } catch (err) {
    return {
      parsedCount: 0,
      sampleTlds: [],
      samplePrices: [],
      passed: false,
      strategy: "playwright",
      reason: `浏览器渲染验证失败: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

/** 按策略做确定性验证(html 走同步表格;json 类抓数据端点/复用快照;playwright 走浏览器服务) */
async function verifyForStrategy(html: string, rule: DynamicRule): Promise<RuleVerification> {
  const strategy = ruleStrategyOf(rule)
  if (strategy === "html") return verifyRule(html, rule)
  if (strategy === "playwright") return browserExtract(rule)

  let raw = html
  if (strategy === "json" || strategy === "api") {
    const dataUrl = rule.dataUrl ?? rule.urls[0]
    const fetched = await fetchText(dataUrl, DATA_LIMIT)
    if (!fetched) {
      return {
        parsedCount: 0,
        sampleTlds: [],
        samplePrices: [],
        passed: false,
        strategy,
        reason: `数据端点 ${dataUrl} 抓取失败(超时/反爬/需凭证)`,
      }
    }
    raw = fetched
  }

  try {
    const prices = extractPricesFromRaw(strategy, raw, rule)
    return summarize(prices, strategy)
  } catch (err) {
    return {
      parsedCount: 0,
      sampleTlds: [],
      samplePrices: [],
      passed: false,
      strategy,
      reason: `[${strategy}] 抽取失败: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

/** 把扫描信号浓缩成给 LLM 的提示文本 */
function scanHint(scan: ScanResult): string {
  const sig = scan.signals
    .filter((s) => s.detected)
    .map((s) => `${s.strategy}(强度${s.strength}): ${s.detail}`)
    .join("; ")
  const eps: string[] = []
  if (scan.endpoints.api.length) eps.push(`api: ${scan.endpoints.api.slice(0, 5).join(", ")}`)
  if (scan.endpoints.xhr.length) eps.push(`xhr: ${scan.endpoints.xhr.slice(0, 5).join(", ")}`)
  if (scan.endpoints.graphql.length) eps.push(`graphql: ${scan.endpoints.graphql.slice(0, 3).join(", ")}`)
  return [
    `扫描建议策略: ${scan.suggestedStrategy ?? "无(可能需浏览器渲染或官方 API)"}`,
    sig ? `检测到的信号: ${sig}` : "未检测到明确价格信号",
    eps.length ? `发现的候选端点: ${eps.join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

/**
 * 对指定注册商执行一轮 LLM 修复。
 * candidateUrls: 供模型选择的候选价格页(来自 discovery_metadata / 人工提供 / 历史配置)
 */
export async function repairAdapter(slug: string, candidateUrls: string[]): Promise<RepairResult> {
  const [reg] = await db.select().from(registrars).where(eq(registrars.slug, slug))
  if (!reg) return { ok: false, slug, message: `注册商 ${slug} 不存在` }

  // 1+2. 抓取快照 + 扫描策略(放宽:不再要求页面必须含 <table>)
  const probed: { url: string; html: string; scan: ScanResult }[] = []
  for (const url of candidateUrls.slice(0, 3)) {
    const [html, scan] = await Promise.all([snapshot(url), scanPricePage(url)])
    if (html) probed.push({ url, html, scan })
  }
  if (probed.length === 0) {
    return { ok: false, slug, message: "所有候选 URL 均无法抓取(可能被反爬拦截,需代理或官方 API)" }
  }

  // 选最有希望的页面:优先有可用策略信号者,其次表格密度
  const best = probed.sort((a, b) => {
    const sa = a.scan.signals.filter((s) => s.detected).reduce((m, s) => Math.max(m, s.strength), 0)
    const sb = b.scan.signals.filter((s) => s.detected).reduce((m, s) => Math.max(m, s.strength), 0)
    if (sb !== sa) return sb - sa
    return (b.html.match(/<tr/gi)?.length ?? 0) - (a.html.match(/<tr/gi)?.length ?? 0)
  })[0]

  // 3. 沿模型链分析(附带扫描提示)
  let chain
  try {
    chain = await generateWithFallback({
      schema: dynamicRuleSchema,
      system: [
        "你是域名注册商价格页结构分析器。给你一段价格页 HTML 和确定性扫描结果,你输出一份声明式解析配置。",
        "规则:",
        "1. urls 只能从提供的候选列表中选择,禁止编造 URL。",
        "2. columnOrder 描述 TLD 列之后各价格列的语义(register=注册价/首年价, renew=续费价, transfer=转入价, restore=赎回价, skip=非价格列)。",
        "3. 仔细观察数字格式: 1,234.56 是 en;1.234,56 是 eu;1 234,56 是 fr。",
        "4. currency 是页面显示价格的货币(看货币符号: $ € £ kr CHF 円 等)。",
        "",
        "策略选择(strategy 字段,关键):",
        "- 页面是标准 HTML 价格表格 → strategy=html(默认,可省略),用 columnOrder。",
        "- 价格在 Next.js 的 __NEXT_DATA__ 里 → strategy=hydration。",
        "- 价格在 Nuxt 的 __NUXT__ 里 → strategy=nuxt-payload。",
        "- 价格在页面内嵌 <script type=application/json> 里 → strategy=embedded-json。",
        "- 扫描发现独立 JSON/API 端点直接返回价格 → strategy=json 或 api,并把该端点填入 dataUrl。",
        "- 价格完全由 JS 动态渲染、静态 HTML 取不到 → strategy=playwright,并在 browser.waitFor 填价格表挂载后的 CSS 选择器。",
        "",
        "非 html 策略务必提供 fieldMap:{ tld, register?, renew?, transfer? } 指明 JSON 价格项里各字段的键名;",
        "若价格数组在 JSON 深层,用 itemsPath 指明路径(如 props.pageProps.pricing.tlds)。",
        "若价格分页展示(上一页/下一页),填 pagination:{ mode:'query', param:'page' } 或 { mode:'path', pathTemplate:'https://.../page/{page}' }。",
        "5. 不确定时降低 confidence,不要猜测。",
      ].join("\n"),
      prompt: [
        `注册商: ${reg.name} (${slug})`,
        `候选 URL 列表: ${JSON.stringify(candidateUrls)}`,
        `确定性扫描结果(${best.url}):`,
        scanHint(best.scan),
        "",
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
  const strategy = ruleStrategyOf(rule)

  // 4. 确定性验证(LLM 无权直接入库)
  const verification = await verifyForStrategy(best.html, rule)

  // 5. 写入规则表
  if (verification.passed) {
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
      strategy,
      message: `修复成功: ${chain.modelUsed} 用 [${strategy}] 策略解析到 ${verification.parsedCount} 个 TLD,已激活`,
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
    strategy,
    message: `规则验证未通过([${strategy}] 策略): ${verification.reason},已标记人工处理`,
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
