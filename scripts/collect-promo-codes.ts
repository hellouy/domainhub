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
  "PLAN","PLANS","YEAR","MONTH","MONTHLY","ANNUAL","REGISTER","RENEW","TRANSFER","RESTORE","PREMIUM",
  "STANDARD","BUSINESS","PERSONAL","STARTER","PRO","LITE","BASIC","PLUS","MAX","MIN","BEST","TOP",
  "FIRST","LAST","NEXT","PREV","BACK","MORE","LESS","VIEW","SHOW","HIDE","OPEN","CLOSE","COPY","SHARE",
  "DOWNLOAD","UPLOAD","SUBMIT","CANCEL","CONTINUE","CONFIRM","SELECT","CHOOSE","CLICK","TAP","SWIPE",
  "FEATURE","BENEFIT","ADVANTAGE","OFFER","SPECIAL","EXCLUSIVE","LIMITED","BONUS","EXTRA","ADDED",
  "WEEKEND","HOLIDAY","SEASON","SPRING","SUMMER","AUTUMN","WINTER","JANUARY","FEBRUARY","MARCH","APRIL",
  "MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER",
  "BACKGROUND","BORDER","FOOTER","HEADER","NAVBAR","SIDEBAR","WRAPPER","CONTAINER","SECTION",
  "ANIMATION","TRANSFORM","TRANSLATE","ROTATE","SCALE","OPACITY","VISIBILITY","DISPLAY","POSITION",
  "JUSTIFY","CENTER","ALIGN","MARGIN","PADDING","WIDTH","HEIGHT","COLOR","FONT","SIZE","LINE",
  "CONTENT","SCRIPT","STYLE","LINK","META","HEAD","BODY","TABLE","ROW","COLUMN","SPAN","DIV",
  "CLASS","ID","HREF","SRC","ALT","TITLE","DATA","ATTR","PROP","NODE","ELEMENT",
  "TRUE","FALSE","NULL","UNDEFINED","FUNCTION","RETURN","VAR","LET","CONST","THIS","THAT",
  "NRBR","NREUM","BAM","LOADER","CONFIG","ACCOUNT","LICENSE","AGENT","BEACON","DENY","LIST",
  "APPLICATION","TRUST","COOKIES","ENABLED","PRIVACY","DISTRIBUTED","TRACING","AJAX",
])

/** 价格指示关键词(码邻近时高可信) */
const PRICE_INDICATORS = /\$[\d,.]+|\/yr|\/year|\/month|\/mo\b|\d{1,3}%\s*off|discount|deal|promo|coupon|save\s+\$|special\s+offer/i

/** 从 HTML 提取促销码 —— 多层策略:
 *  T1 价格邻近: <CODE> $price (spaceship 风格: DOMAINS COM67 $3.60 /yr)
 *  T2 字母+数字混合 token + 价格邻近 (通用布局)
 *  T3 动作词上下文: use/enter/promo code X (namecheap 风格)
 *  T4 纯大写 token + 强促销上下文 (code: WELCOME / at checkout)
 *  每层独立提取, 合集去重后过滤噪音 */
function extractCodes(html: string): string[] {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ")
  const codes = new Set<string>()

  const isCleanCode = (c: string): boolean =>
    c.length >= 3 && c.length <= 20 && c === c.toUpperCase() && !NOISE.has(c) && !/^\d+$/.test(c)

  // T1: 价格紧邻 —— <CODE> 紧跟 $price (最可靠, 误报极低)
  for (const m of text.matchAll(/\b([A-Z][A-Z0-9]{2,19})\s+\$[\d,.]+/g)) {
    if (isCleanCode(m[1])) codes.add(m[1])
  }
  // 变体: <CODE> $price /yr 或 <CODE> $price/yr
  for (const m of text.matchAll(/\b([A-Z][A-Z0-9]{2,19})\s+\$[\d,.]+\s*\/(?:yr|year|mo|month)/gi)) {
    if (isCleanCode(m[1])) codes.add(m[1])
  }

  // T2: 字母+数字混合 token, 80 字符窗口内有价格指示
  for (const m of text.matchAll(/\b([A-Z]{1,6}[0-9]{1,6}[A-Z0-9]{0,6})\b/g)) {
    const token = m[1]
    if (!isCleanCode(token)) continue
    if (!/[A-Z]/.test(token) || !/[0-9]/.test(token)) continue
    const ctx = text.slice(Math.max(0, m.index - 80), m.index + 80)
    if (PRICE_INDICATORS.test(ctx)) codes.add(token)
  }

  // T3: 动作词上下文 (原有逻辑)
  const CODE_PATTERNS = [
    /(?:use|enter|apply)\s+(?:the\s+)?(?:promo\s+)?code\s+["']?([A-Z0-9]{4,20})["']?/gi,
    /(?:promo|discount|coupon)\s+code\s+(?:is\s+|:?\s*)["']?([A-Z0-9]{4,20})["']?/gi,
    /(?:use|enter)\s+["']?([A-Z0-9]{4,20})["']?\s+at\s+checkout/gi,
    /with\s+(?:promo\s+)?code\s+["']?([A-Z0-9]{4,20})["']?/gi,
    /code\s+["']?([A-Z0-9]{4,20})["']?\s+at\s+checkout/gi,
    /code:\s*["']?([A-Z0-9]{4,20})["']?/gi,
  ]
  for (const pat of CODE_PATTERNS) {
    for (const m of text.matchAll(pat)) {
      if (m[1] && isCleanCode(m[1])) codes.add(m[1])
    }
  }

  // T4: 纯大写 token(无数字) + 强促销上下文 (catches WELCOME, SAVEONDOMAINS)
  // 仅在 40 字符窗口内出现 "code:" / "at checkout" / "use" + "code" 时才采信
  for (const m of text.matchAll(/\b([A-Z]{4,20})\b/g)) {
    const token = m[1]
    if (!isCleanCode(token)) continue
    if (/[0-9]/.test(token)) continue // 有数字的已被 T2 覆盖
    const ctx = text.slice(Math.max(0, m.index - 50), m.index + 50).toLowerCase()
    if (/code:|at checkout|use code|enter code|promo code|coupon code|copy code|apply code/.test(ctx)) {
      codes.add(token)
    }
  }

  return [...codes]
}

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

/** 聚合抓取服务(8090/api/auto)统一渲染: 内置 FlareSolverr 过 Cloudflare + Browserless JS 渲染 + Redis 1h 缓存。
 *  这是唯一渲染通道, 不再依赖本地 browser-worker / 远端 playwright(两者与聚合服务同主机, 互为冗余无意义)。
 *  服务由 crontab 每分钟探活自愈, 限流 30 次/分钟每 key。 */
const CF_CHALLENGE_SIGNS = ["just a moment", "attention required", "cf-chl", "challenge-platform", "cf-please-wait", "checking your browser"]

function looksLikeChallenge(html: string): boolean {
  if (html.length > 200_000) return false
  const lower = html.toLowerCase()
  return CF_CHALLENGE_SIGNS.some((s) => lower.includes(s))
}

let abConsecutiveFails = 0
let abDisabledUntil = 0
const abCallTimes: number[] = []

async function renderViaAggregate(url: string): Promise<string> {
  if (!CRAWL_SERVICE_URL || !CRAWL_SERVICE_TOKEN) return ""
  if (Date.now() < abDisabledUntil) return ""
  // 限流: 每分钟最多 25 次(服务限制 30/min, 留 5 次余量)
  const now = Date.now()
  while (abCallTimes.length > 0 && now - abCallTimes[0] > 60_000) abCallTimes.shift()
  if (abCallTimes.length >= 25) {
    const wait = 60_000 - (Date.now() - abCallTimes[0]) + 500
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
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as { html?: string; used_mode?: string }
    if (typeof data.html !== "string" || !data.html) throw new Error("empty html")
    if (looksLikeChallenge(data.html)) throw new Error("challenge page")
    abConsecutiveFails = 0
    return data.html
  } catch {
    abConsecutiveFails++
    // 连续 5 次失败才熔断, 冷却 30s(小于 crontab 1 分钟自愈周期, 下个周期就能重探)
    if (abConsecutiveFails >= 5) {
      abDisabledUntil = Date.now() + 30_000
      abConsecutiveFails = 0
    }
    return ""
  }
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
        const html = await renderViaAggregate(u)
        if (!html) continue
        codes = extractCodes(html)
        if (codes.length > 0) break
      }
      if (codes.length === 0) {
        for (const p of COMMON_PROMO_PATHS) {
          if (!underDeadline()) break
          const html = await renderViaAggregate(`${base}${p}`)
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
