/**
 * 官方促销码自动化采集 —— SearXNG 定向搜索 + 远端 Playwright 渲染提取
 * ---------------------------------------------------------------------
 * 所有权: Data Team
 *
 * 流程(对每个活跃注册商):
 *   1. SearXNG `site:<host> promo code OR promos OR deals OR coupons` 找到官方促销页
 *   2. 远端 playwright(browser-worker 8840) 渲染促销页, 提取"use code X"/"promo code X"上下文
 *   3. 甄别噪音(颜色值/CSS/JS/常见词), 保留真实促销码
 *   4. 通用码 SQL 落库为该注册商全部 TLD 行的 promo_code(数组去重追加)
 *
 * 运行:
 *   export SEARXNG_BASE_URL SEARXNG_TOKEN BROWSER_SERVICE_URL BROWSER_SERVICE_TOKEN DATABASE_URL
 *   npx tsx scripts/collect-promo-codes.ts            # 全部活跃注册商
 *   npx tsx scripts/collect-promo-codes.ts <slug...>  # 指定注册商
 */
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { registrars } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const SEARXNG_BASE = process.env.SEARXNG_BASE_URL ?? "https://paqu.china.tn"
const SEARXNG_TOKEN = process.env.SEARXNG_TOKEN ?? ""
const BROWSER_URL = process.env.BROWSER_SERVICE_URL ?? "http://127.0.0.1:8840"
const BROWSER_TOKEN = process.env.BROWSER_SERVICE_TOKEN ?? ""
const CRAWL_SERVICE_URL = process.env.CRAWL_SERVICE_URL ?? ""
const CRAWL_SERVICE_TOKEN = process.env.CRAWL_SERVICE_TOKEN ?? ""

/** 真实码甄别: 颜色值/CSS/JS/常见词 排除 */
const NOISE = new Set([
  "HTML","DOCTYPE","HTTP","HTTPS","THE","AND","FOR","WITH","DOMAIN","DOMAINS","SAVE","PROMO","PROMOS",
  "CODE","CODES","COUPON","NAME","EMAIL","PASSWORD","CONTACT","FOLLOW","FACEBOOK","TWITTER","INSTAGRAM",
  "YOUTUBE","BLOG","CAREERS","LEGAL","PRIVACY","TERMS","NEWS","SIGNUP","LOGIN","ORDER","CART","CHECKOUT",
  "SEARCH","MENU","PRICE","SUPPORT","HELP","FAQS","ABOUT","GUIDES","BLACK","FRIDAY","CYBER","MONDAY",
  "BUNDLE","DEALS","SALES","FREE","NEW","LIVE","LIFE","TODAY","TOKEN","CONFIG","JSON","STATE","COOKIE",
  "POST","GET","PUT","HOST","PORT","USER","PASS","SHA","HASH","SALT","BASE","TEST","DEMO","SAMPLE",
  "HOME","SIGNUP","SOCIAL","AREA","GROUP","TYPE","VALUE","FORM","INPUT","FIELD","LABEL","TITLE","LOADING",
  "ERROR","WARNING","SUCCESS","FAILED","PENDING","STATUS","ROLE","PERMISSION","ADMIN","MODERATOR","OWNER",
])

/** 真实码上下文正则: 出现 use/enter/promo code/at checkout 等动作词 */
const CODE_PATTERNS = [
  /(?:use|enter|apply)\s+(?:the\s+)?(?:promo\s+)?code\s+["']?([A-Z0-9]{4,20})["']?/gi,
  /(?:promo|discount|coupon)\s+code\s+(?:is\s+|:?\s*)["']?([A-Z0-9]{4,20})["']?/gi,
  /(?:use|enter)\s+["']?([A-Z0-9]{4,20})["']?\s+at\s+checkout/gi,
  /with\s+(?:promo\s+)?code\s+["']?([A-Z0-9]{4,20})["']?/gi,
  /code\s+["']?([A-Z0-9]{4,20})["']?\s+at\s+checkout/gi,
]

async function searxSearch(host: string): Promise<string[]> {
  const q = `site:${host} promo code OR promos OR deals OR coupons`
  for (let attempt = 0; attempt < 3; attempt++) {
    const url = `${SEARXNG_BASE}/search?format=json&q=${encodeURIComponent(q)}`
    try {
      const res = await fetch(url, {
        headers: SEARXNG_TOKEN ? { Authorization: `Bearer ${SEARXNG_TOKEN}` } : {},
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) continue
      const data = (await res.json()) as { results?: Array<{ url: string }> }
      const urls = (data.results ?? []).map((r) => r.url).filter((u) => u.includes(host))
      if (urls.length > 0) return urls
    } catch (e) {
      /* 网络抖动, 重试 */
    }
  }
  return []
}

async function renderPage(url: string, timeoutMs = 35_000): Promise<string> {
  try {
    const res = await fetch(`${BROWSER_URL}/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(BROWSER_TOKEN ? { Authorization: `Bearer ${BROWSER_TOKEN}` } : {}),
      },
      body: JSON.stringify({ url, extract: "html", scrollToBottom: true, waitForTimeoutMs: 12_000 }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return ""
    const data = (await res.json()) as { ok?: boolean; html?: string; error?: string }
    if (!data.ok || !data.html) return ""
    return data.html
  } catch {
    return ""
  }
}

/** worker /health 门控: 远端 playwright 挂掉时 /health 会挂起, 5s 内不响应则跳过 worker 渲染 */
let workerHealthCheckedAt = 0
let workerHealthy = true

async function isWorkerHealthy(): Promise<boolean> {
  if (Date.now() - workerHealthCheckedAt < 60_000) return workerHealthy
  workerHealthCheckedAt = Date.now()
  try {
    const res = await fetch(`${BROWSER_URL}/health`, { signal: AbortSignal.timeout(5_000) })
    if (!res.ok) { workerHealthy = false; return false }
    const data = (await res.json()) as { chromiumAvailable?: boolean }
    // chromiumAvailable=false 表示远端 playwright 断连, 渲染必然失败, 应跳过 worker
    workerHealthy = data.chromiumAvailable === true
  } catch {
    workerHealthy = false
  }
  return workerHealthy
}

/** anti-bot 熔断器 + 限流: 服务限流 30 次/分, 每分钟 crontab 自愈,
 *  连续失败后短暂停用(90s)对齐自愈周期, 避免每条路径空耗 */
let abConsecutiveFails = 0
let abDisabledUntil = 0
const abCallTimes: number[] = []

async function renderViaAntiBot(url: string): Promise<string> {
  if (!CRAWL_SERVICE_URL || !CRAWL_SERVICE_TOKEN) return ""
  if (Date.now() < abDisabledUntil) return ""
  // 限流: 保留 5 次余量, 每分钟最多 25 次
  const now = Date.now()
  while (abCallTimes.length > 0 && now - abCallTimes[0] > 60_000) abCallTimes.shift()
  if (abCallTimes.length >= 25) {
    const wait = 60_000 - (now - abCallTimes[0]) + 500
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  }
  abCallTimes.push(Date.now())
  try {
    const res = await fetch(`${CRAWL_SERVICE_URL}/api/auto`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": CRAWL_SERVICE_TOKEN,
      },
      body: JSON.stringify({ url, keyword: null }),
      signal: AbortSignal.timeout(45_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as { html?: string; used_mode?: string }
    if (typeof data.html !== "string" || !data.html) throw new Error("empty html")
    abConsecutiveFails = 0
    return data.html
  } catch {
    abConsecutiveFails++
    if (abConsecutiveFails >= 3) {
      abDisabledUntil = Date.now() + 90_000
      console.log(`  [anti-bot] 连续 ${abConsecutiveFails} 次失败, 熔断 90s(对齐自愈周期)`)
    }
    return ""
  }
}

/** 渲染带兜底: worker 失败或拿到 Cloudflare 挑战页时走 anti-bot。
 *  注意: worker 渲染 CF 挑战页也算"成功"(ok:true + 挑战页 HTML), 必须按特征识别后降级 */
const CF_CHALLENGE_SIGNS = ["just a moment", "attention required", "cf-chl", "challenge-platform", "cf-please-wait", "checking your browser"]

function looksLikeChallenge(html: string): boolean {
  if (html.length > 200_000) return false // 真实促销页内容量大, 挑战页都很小
  const lower = html.toLowerCase()
  return CF_CHALLENGE_SIGNS.some((s) => lower.includes(s))
}

async function renderWithFallback(url: string): Promise<string> {
  // worker 健康门控: 远端 playwright 挂掉时 /health 会挂起, 检测到不可用直接跳 worker 走 anti-bot
  let html = ""
  if (await isWorkerHealthy()) {
    html = await renderPage(url)
    if (html && !looksLikeChallenge(html)) return html
  }
  const viaAb = await renderViaAntiBot(url)
  if (viaAb && !looksLikeChallenge(viaAb)) return viaAb
  return ""
}

/** 从 HTML 提取真实促销码(带动作词上下文) */
function extractCodes(html: string): string[] {
  const text = html.replace(/<[^>]+>/g, " ")
  const codes = new Set<string>()
  for (const pat of CODE_PATTERNS) {
    for (const m of text.matchAll(pat)) {
      if (m[1]) codes.add(m[1])
    }
  }
  return [...codes].filter((c) => c.length >= 4 && c === c.toUpperCase() && !NOISE.has(c.toUpperCase()))
}

/** 通用码落库: 映射该注册商全部 TLD 行(对象数组去重合并, 首码为主码) */
async function persistCodes(registrarId: number, slug: string, codes: string[]): Promise<number> {
  if (codes.length === 0) return 0
  const objs = codes.map((c) => ({ code: c }))
  const codesJson = JSON.stringify(objs)
  const res = await db.execute(sql`
    UPDATE prices
    SET promo_codes = (
      SELECT jsonb_agg(DISTINCT x) FROM jsonb_array_elements(
        COALESCE(promo_codes, '[]'::jsonb) || ${codesJson}::jsonb
      ) x
    ),
    promo_code = COALESCE(
      (SELECT (x->>'code') FROM jsonb_array_elements(
        COALESCE(promo_codes, '[]'::jsonb) || ${codesJson}::jsonb
      ) x WHERE x->>'code' IS NOT NULL ORDER BY x->>'code' LIMIT 1),
      promo_code
    ),
    updated_at = NOW()
    WHERE registrar_id = ${registrarId}
  `)
  return res.rowCount ?? 0
}

async function main() {
  const args = process.argv.slice(2)
  const regs = await db.select().from(registrars).where(eq(registrars.isActive, true))
  const targets = args.length > 0
    ? (await Promise.all(args.map(async (slug) => (await db.select().from(registrars).where(eq(registrars.slug, slug)))[0]))).filter(Boolean)
    : regs

  console.log(`待采集 ${targets.length} 家注册商促销码\n`)
  let withCodes = 0
  const COMMON_PROMO_PATHS = ["/promos", "/promocodes", "/promo", "/deals", "/offers", "/domain/sales", "/sales", "/special-offers", "/promotions"]
  for (const r of targets) {
    const regStart = Date.now()
    // 单家硬性上限 4 分钟: 避免单家卡死拖垮整轮(9 路径 × 最坏 ~25s)
    const REG_DEADLINE = 4 * 60_000
    const underDeadline = () => Date.now() - regStart < REG_DEADLINE
    try {
      const base = r.website?.replace(/\/$/, "") ?? ""
      const host = base.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "")
      let urls = await searxSearch(host)
      await new Promise((res) => setTimeout(res, 6_000)) // SearXNG 限流冷却
      let codes: string[] = []
      for (const u of urls.slice(0, 3)) {
        if (!underDeadline()) break
        const html = await renderWithFallback(u)
        if (!html) continue
        codes = extractCodes(html)
        if (codes.length > 0) break
      }
      if (codes.length === 0) {
        for (const p of COMMON_PROMO_PATHS) {
          if (!underDeadline()) break
          const html = await renderWithFallback(`${base}${p}`)
          if (!html) continue
          codes = extractCodes(html)
          if (codes.length > 0) break
        }
      }
      if (codes.length > 0) {
        const updated = await persistCodes(r.id, r.slug, codes)
        withCodes++
        console.log(`OK   ${r.slug.padEnd(16)} codes=[${codes.join(",")}] 落库=${updated} 行 (${((Date.now()-regStart)/1000).toFixed(0)}s)`)
      } else {
        console.log(`SKIP ${r.slug.padEnd(16)} 未找到官方促销码(${((Date.now()-regStart)/1000).toFixed(0)}s)`)
      }
    } catch (e: any) {
      console.log(`FAIL ${r.slug.padEnd(16)} ${e.message.slice(0, 100)}`)
    }
  }
  console.log(`\n完成: ${targets.length} 家, ${withCodes} 家落码`)
}
main().catch((e) => { console.error(e); process.exit(1) })
