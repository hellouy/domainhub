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

/** 官方促销页已知 URL(slug -> URL 列表), 命中后跳过 SearXNG 发现 */
const KNOWN_PROMO_URLS: Record<string, string[]> = {
  spaceship: ["https://www.spaceship.com/zh/promos/", "https://www.spaceship.com/promos/"],
  namesilo: ["https://www.namesilo.com/discounts-and-promotions"],
  namecheap: ["https://www.namecheap.com/promos/"],
  hostinger: ["https://www.hostinger.com/domain-coupon-codes"],
  ovhcloud: ["https://www.ovhcloud.com/en/domains/"],
  inwx: ["https://www.inwx.com/en/offer"],
  networksolutions: ["https://www.networksolutions.com/coupons"],
  dreamhost: ["https://www.dreamhost.com/domains/promo-codes/"],
  /* 以下官方促销页 2026-10 已下线/改版, 移除避免每轮白请求 404:
     gandi /en/domain/promotions(Page Not Found)
     101domain /domain_promotions.htm(404)
     porkbun /products/promotions(404)
     dynadot /community/sales.html(404)
     namecom /promo-codes(404)
     onlydomains /deals(Page not found)
     namecheap /domains/99-cent-domains/(404, 已并入 /promos/ 月度码) */
}

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

  // T0: 页面数据层 coupons 字段优先 (JSON 标注的当期码, 比 DOM 文本最可靠, 排在 Set 最前)
  for (const m of text.matchAll(/"coupons"\s*:\s*"([^"]+)"/g)) {
    for (const part of m[1].split(",")) {
      const code = part.trim().toUpperCase()
      if (isCleanCode(code)) codes.add(code)
    }
  }

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

/** 结构化促销条目：某后缀的促销价/优惠码/原价/折扣率 */
export interface StructuredDeal {
  tld: string
  code?: string
  promotionPrice?: number
  oldPrice?: number
  discountPct?: number
}

/**
 * 结构化促销卡解析（spaceship 官方促销页 data-zid="dealCard" 布局等）：
 *   卡片含 TLD + 促销价 + 划线原价 + 优惠码按钮（gb-button__text）。
 * 非该布局返回 null，调用方回退通用 extractCodes。
 * 仅保留注册类域名卡（剔除转移/托管/邮箱等产品卡）。
 */
export function extractStructuredDeals(html: string): StructuredDeal[] | null {
  if (!html.includes('data-zid="dealCard"')) return null
  const cards = html.split(/(?=<div data-zid="dealCard")/)
  const deals: StructuredDeal[] = []
  for (const card of cards) {
    if (!card.includes("promos-deal-card__footer")) continue
    const title = card.match(/(?:data-zid="dealCardTitle"[^>]*>)([^<]+)</)?.[1]?.trim()
    const name = card.match(/data-zid="dealCardName"[^>]*>\s*<span[^>]*>([^<]+)</)?.[1]?.trim()
    const priceRaw = card.match(/promos-deal-card__price" data-zid="dealCardPrice"[^>]*>[\s\S]*?\$\s*([\d.,]+)/)?.[1]
    const oldRaw = card.match(/promos-deal-card__price-old" data-zid="dealCardPrice"[^>]*>[\s\S]*?\$\s*([\d.,]+)/)?.[1]
    const btn = card.match(/data-zid="promoCode"[^>]*>([\s\S]*?)<\/button>/)
    let code = ""
    if (btn) {
      const txt = btn[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      const m = txt.match(/[A-Za-z0-9]{3,20}/)
      if (m) code = m[0].toUpperCase()
    }
    const tld = title?.match(/^\.([a-z0-9]{2,63})$/i)?.[1]
    if (!tld) continue
    if (/transfer|转移/.test((name ?? "").toLowerCase())) continue // 只收集注册类促销
    const deal: StructuredDeal = { tld }
    if (code && code.length >= 3 && code.length <= 20 && !NOISE.has(code)) deal.code = code
    const price = priceRaw ? parseFloat(priceRaw) : NaN
    const old = oldRaw ? parseFloat(oldRaw) : NaN
    if (!Number.isNaN(price)) {
      deal.promotionPrice = price
      if (!Number.isNaN(old) && old > 0) {
        deal.oldPrice = old
        deal.discountPct = Math.round((1 - price / old) * 100)
      }
    }
    deals.push(deal)
  }
  return deals.length ? deals : null
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

let abSlowFails = 0
let abDisabledUntil = 0
const abCallTimes: number[] = []

async function renderViaAggregate(url: string): Promise<string> {
  if (!CRAWL_SERVICE_URL || !CRAWL_SERVICE_TOKEN) return ""
  if (Date.now() < abDisabledUntil) return ""
  // 限流: 每分钟最多 12 次(服务限制 30/min, 每 registrar 只 6 次, 留 2x 余量)
  const now = Date.now()
  while (abCallTimes.length > 0 && now - abCallTimes[0] > 60_000) abCallTimes.shift()
  if (abCallTimes.length >= 12) {
    const wait = 60_000 - (Date.now() - abCallTimes[0]) + 500
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  }
  abCallTimes.push(Date.now())
  const callStart = Date.now()
  try {
    const res = await fetch(`${CRAWL_SERVICE_URL}/api/auto`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": CRAWL_SERVICE_TOKEN,
      },
      body: JSON.stringify({ url, keyword: null }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as { html?: string; used_mode?: string }
    if (typeof data.html !== "string" || !data.html) throw new Error("empty html")
    if (looksLikeChallenge(data.html)) throw new Error("challenge page")
    abSlowFails = 0
    return data.html
  } catch (e: any) {
    const elapsed = Date.now() - callStart
    console.log(`  [render] FAIL ${e.message?.slice(0,60) || e.name} elapsed=${elapsed}ms`)
    // 快速拒连(< 2s) = crontab 重启窗口, 代价极低, 不触发熔断
    // 慢速超时(≥ 2s) = 服务僵死, 累积 3 次后熔断 30s
    if (elapsed >= 2_000) {
      abSlowFails++
      if (abSlowFails >= 5) {
        abDisabledUntil = Date.now() + 30_000
        abSlowFails = 0
      }
    }
    return ""
  }
}

/** 本地 browser-worker(8840) 渲染, 作为聚合服务故障时的降级通道 */
async function renderViaLocal(url: string): Promise<string> {
  const workerUrl = process.env.BROWSER_SERVICE_URL ?? "http://127.0.0.1:8840"
  const token = process.env.BROWSER_SERVICE_TOKEN ?? ""
  try {
    const res = await fetch(`${workerUrl}/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ url, extract: "html", scrollToBottom: true, waitForTimeoutMs: 25_000 }),
      signal: AbortSignal.timeout(35_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const j = (await res.json()) as { html?: string }
    if (typeof j.html !== "string" || !j.html) throw new Error("empty html")
    if (looksLikeChallenge(j.html)) throw new Error("challenge page")
    return j.html
  } catch (e: any) {
    console.log(`  [render:local] FAIL ${e.message?.slice(0, 60) || e.name}`)
    return ""
  }
}

/** 渲染主通道: 聚合服务优先, 失败回退本地 worker */
async function renderPage(url: string): Promise<string> {
  const html = await renderViaAggregate(url)
  if (html) return html
  return renderViaLocal(url)
}

/** TLD 特定码(slug -> code -> tld): 只写入对应后缀行, 避免污染全部 TLD 行 */
const TLD_CODE_MAP: Record<string, Record<string, string>> = {
  spaceship: { COM67: "com", NET19: "net", IO85: "io", XYZ52: "xyz", SPSR86: "top" },
  namecheap: { NETDEAL1168: "net", NEWCOM679: "com", NCSIREG26: "si" },
}

/** 产品码(非域名促销, 如 VPN/托管/邮箱): 不写入域名价格行 */
const PRODUCT_CODES: Record<string, Set<string>> = {
  spaceship: new Set(["FASTVPN", "HOSTING", "SPACEMAIL", "WORDPRESS"]),
  // namecheap coupons 字段中非域名产品(托管/VPS/SSL/建站/社交): 不写域名价格行
  namecheap: new Set([
    "SHAREDHOSTING", "VPSHOSTING", "DEDICATEDSERVERS", "SITEMAKERTRIAL", "EASYWPTRIAL",
    "RELATESOCIAL", "RELATEADS", "DOMAINVAULT", "AUTO_MULTI_YEAR_SSL",
  ]),
}

/** 将一组码按后缀写入 prices 行; TLD 特定码只写对应后缀行, 其余为站级码写全部行 */
async function persistCodes(registrarId: number, slug: string, codes: string[]): Promise<number> {
  if (codes.length === 0) return 0
  const tldMap = TLD_CODE_MAP[slug] ?? {}
  const productSet = PRODUCT_CODES[slug] ?? new Set<string>()
  const siteWide = codes.filter((c) => !productSet.has(c) && !Object.prototype.hasOwnProperty.call(tldMap, c))
  if (siteWide.length === 0 && codes.length > 0 && Object.keys(tldMap).length === 0) return 0

  let total = 0
  // 1) 站级码 -> 全部 TLD 行
  if (siteWide.length > 0) {
    const objs = siteWide.map((c) => ({ code: c }))
    const keepSql = productSet.size
      ? `(SELECT jsonb_agg(value) FROM jsonb_array_elements(COALESCE(promo_codes, '[]'::jsonb))
         WHERE NOT (value->>'code' IN (${[...productSet].map((c) => `'${c}'`).join(",")})))`
      : `COALESCE(promo_codes, '[]'::jsonb)`
    const res = await db.execute(sql`
      UPDATE prices
      SET promo_codes = (
        SELECT jsonb_agg(DISTINCT value) FROM jsonb_array_elements(
          ${JSON.stringify(objs)}::jsonb || ${sql.raw(keepSql)}
        ) WITH ORDINALITY
      ),
      promo_code = COALESCE(
        (SELECT value->>'code' FROM jsonb_array_elements(
          ${JSON.stringify(objs)}::jsonb || COALESCE(promo_codes, '[]'::jsonb)
        ) WITH ORDINALITY WHERE value->>'code' IS NOT NULL
        ORDER BY ordinality
        LIMIT 1),
        promo_code
      ),
      updated_at = NOW()
      WHERE registrar_id = ${registrarId}
    `)
    total += res.rowCount ?? 0
  }
  // 2) TLD 特定码 -> 对应后缀行
  for (const [code, tld] of Object.entries(tldMap)) {
    if (!codes.includes(code)) continue
    const res = await db.execute(sql`
      UPDATE prices
      SET promo_codes = (
        SELECT jsonb_agg(DISTINCT value) FROM jsonb_array_elements(
          ${JSON.stringify([{ code }])}::jsonb || COALESCE(promo_codes, '[]'::jsonb)
        ) WITH ORDINALITY
      ),
      promo_code = COALESCE(
        (SELECT value->>'code' FROM jsonb_array_elements(
          ${JSON.stringify([{ code }])}::jsonb || COALESCE(promo_codes, '[]'::jsonb)
        ) WITH ORDINALITY WHERE value->>'code' IS NOT NULL
        ORDER BY ordinality
        LIMIT 1),
        promo_code
      ),
      updated_at = NOW()
      WHERE registrar_id = ${registrarId}
        AND tld_id = (SELECT id FROM tlds WHERE tld = ${tld})
    `)
    total += res.rowCount ?? 0
  }
  return total
}

/**
 * 结构化促销落库：按 TLD 精确写入促销价/优惠码/原价/sourceUrl。
 * 促销价须低于标准注册价才写（防脏数据），否则只保留码与来源。
 * 返回更新的行数。
 */
export async function persistStructuredDeals(
  registrarId: number,
  deals: StructuredDeal[],
  sourceUrl: string,
): Promise<number> {
  let total = 0
  for (const d of deals) {
    const entry: Record<string, unknown> = { code: d.code ?? null }
    if (d.promotionPrice != null) entry.promotionPrice = d.promotionPrice
    if (d.oldPrice != null) entry.oldPrice = d.oldPrice
    if (d.discountPct != null) entry.discountPct = d.discountPct
    entry.sourceUrl = sourceUrl
    const res = await db.execute(sql`
      UPDATE prices
      SET promo_codes = (
        SELECT COALESCE(
          (SELECT jsonb_agg(t.x) FROM (
            SELECT x FROM jsonb_array_elements(COALESCE(prices.promo_codes, '[]'::jsonb)) x
            WHERE x->>'code' IS DISTINCT FROM ${d.code ?? null}
          ) t) || jsonb_build_array(${JSON.stringify(entry)}::jsonb),
          jsonb_build_array(${JSON.stringify(entry)}::jsonb)
        )
      ),
      promo_code = COALESCE(
        (SELECT x->>'code' FROM jsonb_array_elements(
          (SELECT COALESCE(
            (SELECT jsonb_agg(t.x) FROM (
              SELECT x FROM jsonb_array_elements(COALESCE(prices.promo_codes, '[]'::jsonb)) x
              WHERE x->>'code' IS DISTINCT FROM ${d.code ?? null}
            ) t) || jsonb_build_array(${JSON.stringify(entry)}::jsonb),
            jsonb_build_array(${JSON.stringify(entry)}::jsonb)
          ))
        ) x WHERE x->>'code' IS NOT NULL
        ORDER BY (x->>'promotionPrice')::numeric ASC NULLS LAST, x->>'code' LIMIT 1),
        promo_code
      ),
      promotion_price = CASE
        WHEN ${d.promotionPrice}::numeric IS NOT NULL
         AND ${d.promotionPrice}::numeric < register_price
        THEN ${d.promotionPrice}::numeric
        ELSE promotion_price
      END,
      source_url = ${sourceUrl},
      updated_at = NOW()
      WHERE registrar_id = ${registrarId}
        AND tld_id = (SELECT id FROM tlds WHERE tld = ${d.tld})
    `)
    total += res.rowCount ?? 0
  }
  return total
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
      let urls = KNOWN_PROMO_URLS[r.slug] ?? (await searxSearch(host))
      if (!KNOWN_PROMO_URLS[r.slug]) await new Promise((res) => setTimeout(res, 6_000)) // SearXNG 限流冷却
      let codes: string[] = []
      let structuredHit = false
      for (const u of urls.slice(0, 3)) {
        if (!underDeadline()) break
        // 每 URL 只试一次: Redis 缓存已覆盖之前探测过的 URL,一次命中即可
        // 失败则快速跳过,避免堆积在 rate limit 队列
        const html = await renderPage(u)
        if (!html) continue
        // 优先结构化解析（优惠码+促销价+原价）, 失败才回退通用码提取
        const deals = extractStructuredDeals(html)
        if (deals && deals.length) {
          const updated = await persistStructuredDeals(r.id, deals, u)
          if (updated > 0) {
            structuredHit = true
            codes = deals.filter((d) => d.code).map((d) => d.code as string)
            withCodes++
            console.log(`OK   ${r.slug.padEnd(16)} 结构化促销 ${deals.length} 卡(含码${codes.length}个) 落库=${updated} 行 (${((Date.now()-regStart)/1000).toFixed(0)}s)`)
          }
          break
        }
        codes = extractCodes(html)
        if (codes.length > 0) break
      }
      if (structuredHit) continue
      if (codes.length === 0) {
        // common paths 只试前 3 个(原 9 个),减少调用量
        for (const p of COMMON_PROMO_PATHS.slice(0, 3)) {
          if (!underDeadline()) break
          const html = await renderPage(`${base}${p}`)
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
