/**
 * Registrar Discovery Engine —— 注册商发现引擎
 * ------------------------------------------------------------
 * 所有权: Platform Team
 *
 * 输入一个 URL(注册商主站或价格页),自动:
 *   1. 归一化 URL,推导主站 + 一组候选价格页路径(/pricing,/domains,/tlds...)
 *   2. 抓取候选页,用确定性信号(TLD+价格表格行数、货币符号、关键词)打分
 *   3. 选出信号最强的价格页,推断注册商名称
 *   4. 产出候选并 upsert 进 registrar_candidates(按 website 去重,人工审核前不入正式表)
 *
 * 只做"发现",不生成规则、不采集价格——规则由 AI 修复代理(ai-repair)在审核后生成。
 * 全程无 LLM,零成本;抓取用带超时的原生 fetch,不占用采集限流器。
 */

import { eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { registrarCandidates, registrars } from "@/lib/db/schema"
import { extractTableRows, findTldCell, parsePrice } from "@/adapters/shared/table-adapter"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

const FETCH_TIMEOUT_MS = 20_000
const SNAPSHOT_LIMIT = 200_000

/** 常见价格页路径(相对主站根),按命中概率排序 */
const CANDIDATE_PATHS = [
  "",
  "/pricing",
  "/domains",
  "/domain-pricing",
  "/domains/pricing",
  "/domain/pricing",
  "/tld",
  "/tlds",
  "/prices",
  "/price",
  "/domains/prices",
]

/** URL 或路径里的价格页关键词 */
const PRICING_KEYWORDS = /(pricing|price|domains?|tld|register|renewal|extensions?)/i

/** 单页扫描证据 */
export interface PageEvidence {
  url: string
  ok: boolean
  status?: number
  contentType?: string | null
  /** 解析到的 TLD+价格行数(最强信号) */
  priceRowCount: number
  /** 示例后缀 */
  sampleTlds: string[]
  /** 页面是否含货币符号 */
  hasCurrency: boolean
  /** 页面 <title> */
  title?: string
  /** 本页信号分 0-100 */
  score: number
}

/** 发现产出的候选 */
export interface DiscoveryCandidate {
  name: string
  website: string
  pricePage: string | null
  confidence: number
  evidence: {
    pages: PageEvidence[]
    detectedStrategy: "html"
    bestUrl: string | null
  }
}

/** 归一化输入 URL,返回 { origin, homepage },失败返回 null */
function normalizeInput(rawUrl: string): { origin: string; homepage: string } | null {
  try {
    const withProto = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`
    const u = new URL(withProto)
    return { origin: u.origin, homepage: `${u.origin}/` }
  } catch {
    return null
  }
}

/** 带超时抓取页面文本,失败返回 null */
async function fetchPage(
  url: string,
): Promise<{ html: string; status: number; contentType: string | null } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    })
    const contentType = res.headers.get("content-type")
    if (!res.ok) return { html: "", status: res.status, contentType }
    const text = await res.text()
    return { html: text.length > SNAPSHOT_LIMIT ? text.slice(0, SNAPSHOT_LIMIT) : text, status: res.status, contentType }
  } catch {
    return null
  }
}

/** 从 HTML 提取 <title> */
function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!m) return undefined
  return m[1].replace(/\s+/g, " ").trim().slice(0, 200) || undefined
}

/** 统计一页里"TLD + 至少一个有效价格"的表格行数与样例 */
function countPriceRows(html: string): { count: number; samples: string[] } {
  const rows = extractTableRows(html)
  const seen = new Set<string>()
  for (const cells of rows) {
    const hit = findTldCell(cells)
    if (!hit) continue
    const [tld, tldIdx] = hit
    if (seen.has(tld)) continue
    let hasPrice = false
    for (let i = tldIdx + 1; i < cells.length; i++) {
      if (parsePrice(cells[i]) !== null) {
        hasPrice = true
        break
      }
    }
    if (hasPrice) seen.add(tld)
  }
  return { count: seen.size, samples: [...seen].slice(0, 10) }
}

/** 对单页打分,产出 PageEvidence */
function scorePage(url: string, html: string, status: number, contentType: string | null): PageEvidence {
  const { count, samples } = countPriceRows(html)
  const hasCurrency = /[$€£¥]|USD|EUR|GBP|CNY|CHF|kr/i.test(html)
  const title = extractTitle(html)

  let score = 0
  if (count >= 10) score += 55
  else if (count >= 3) score += 30
  else if (count >= 1) score += 12
  if (hasCurrency) score += 15
  if (PRICING_KEYWORDS.test(url)) score += 12
  if (title && PRICING_KEYWORDS.test(title)) score += 8
  score = Math.min(100, score)

  return { url, ok: status >= 200 && status < 400, status, contentType, priceRowCount: count, sampleTlds: samples, hasCurrency, title, score }
}

/** 从 title/域名推断注册商名称 */
function inferName(homepage: string, bestTitle?: string): string {
  if (bestTitle) {
    // 取标题分隔符前的主段(如 "Domain Pricing | Porkbun" → "Porkbun" 优先取更像品牌的一段)
    const parts = bestTitle.split(/[|\-–—:·»]/).map((s) => s.trim()).filter(Boolean)
    if (parts.length > 0) {
      // 选最短且不含价格关键词的段作为品牌名,否则取最后一段
      const brandish = parts.filter((p) => !PRICING_KEYWORDS.test(p) && p.length <= 40)
      const pick = brandish.sort((a, b) => a.length - b.length)[0] ?? parts[parts.length - 1]
      if (pick) return pick.slice(0, 80)
    }
  }
  try {
    const host = new URL(homepage).hostname.replace(/^www\./, "")
    const base = host.split(".")[0]
    return base.charAt(0).toUpperCase() + base.slice(1)
  } catch {
    return homepage
  }
}

/**
 * 对单个 URL 执行发现:探测候选路径 → 打分 → 产出候选(不落库)。
 * maxPaths 控制探测的路径数量(默认全部),用于成本控制。
 */
export async function discoverFromUrl(rawUrl: string, maxPaths = CANDIDATE_PATHS.length): Promise<DiscoveryCandidate | null> {
  const norm = normalizeInput(rawUrl)
  if (!norm) return null

  const pages: PageEvidence[] = []
  const paths = CANDIDATE_PATHS.slice(0, maxPaths)
  for (const path of paths) {
    const url = path === "" ? norm.homepage : `${norm.origin}${path}`
    const fetched = await fetchPage(url)
    if (!fetched) {
      pages.push({ url, ok: false, priceRowCount: 0, sampleTlds: [], hasCurrency: false, score: 0 })
      continue
    }
    pages.push(scorePage(url, fetched.html, fetched.status, fetched.contentType))
    // 命中强信号页即可提前结束,省流量
    const last = pages[pages.length - 1]
    if (last.priceRowCount >= 15) break
  }

  const best = [...pages].sort((a, b) => b.score - a.score)[0]
  const confidence = best?.score ?? 0
  const bestUrl = best && best.score > 0 ? best.url : null

  return {
    name: inferName(norm.homepage, best?.title),
    website: norm.homepage,
    pricePage: bestUrl,
    confidence,
    evidence: { pages, detectedStrategy: "html", bestUrl },
  }
}

/** 判断 website 是否已存在于正式注册商表(按主域匹配,避免重复发现) */
async function alreadyRegistered(website: string): Promise<boolean> {
  try {
    const host = new URL(website).hostname.replace(/^www\./, "")
    const rows = await db
      .select({ id: registrars.id })
      .from(registrars)
      .where(sql`${registrars.website} ILIKE ${"%" + host + "%"}`)
      .limit(1)
    return rows.length > 0
  } catch {
    return false
  }
}

/**
 * 发现并落库:对 URL 执行发现,upsert 进 registrar_candidates(按 website 去重)。
 * 已在正式注册商表中的站点会被跳过(status=promoted 记录,避免反复发现)。
 * 返回落库后的候选行信息。
 */
export async function discoverAndSave(
  rawUrl: string,
  source: "seed" | "crawl" | "manual" | "iana" = "manual",
): Promise<{ ok: boolean; message: string; candidateId?: number; confidence?: number }> {
  const candidate = await discoverFromUrl(rawUrl)
  if (!candidate) return { ok: false, message: `无法解析 URL: ${rawUrl}` }

  const isRegistered = await alreadyRegistered(candidate.website)

  const values = {
    name: candidate.name,
    website: candidate.website,
    pricePage: candidate.pricePage,
    source,
    confidence: candidate.confidence,
    status: isRegistered ? ("promoted" as const) : ("pending" as const),
    evidence: candidate.evidence,
    updatedAt: new Date(),
  }

  const [row] = await db
    .insert(registrarCandidates)
    .values(values)
    .onConflictDoUpdate({
      target: registrarCandidates.website,
      // 已审核过(approved/rejected/promoted)的不因重新发现被打回 pending,仅刷新证据与分数
      set: {
        name: values.name,
        pricePage: values.pricePage,
        confidence: values.confidence,
        evidence: values.evidence,
        updatedAt: values.updatedAt,
      },
    })
    .returning({ id: registrarCandidates.id, status: registrarCandidates.status })

  if (isRegistered) {
    return { ok: true, message: `${candidate.website} 已是正式注册商,已记录跳过`, candidateId: row.id, confidence: candidate.confidence }
  }
  return {
    ok: true,
    message: `发现候选「${candidate.name}」,信心分 ${candidate.confidence}${candidate.pricePage ? `,价格页 ${candidate.pricePage}` : "(未探测到明显价格页)"}`,
    candidateId: row.id,
    confidence: candidate.confidence,
  }
}

/** 批量发现:对一组 URL 依次执行 discoverAndSave */
export async function discoverBatch(
  urls: string[],
  source: "seed" | "crawl" | "manual" | "iana" = "seed",
): Promise<{ url: string; ok: boolean; message: string; confidence?: number }[]> {
  const results: { url: string; ok: boolean; message: string; confidence?: number }[] = []
  for (const url of urls) {
    const r = await discoverAndSave(url, source)
    results.push({ url, ok: r.ok, message: r.message, confidence: r.confidence })
  }
  return results
}
