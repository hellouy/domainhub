/**
 * Amen —— 法国注册商（amen.fr），SSR 直连解析（EUR，HT 不含税价）
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源结论(2026-11-06 实测):
 * 1. 主页 /nom-de-domaine/ SSR 含两个发现源：
 *    - tldList widget：65 个 /domains/tld/{tld}.html 链接（无价格，仅发现）
 *    - highlighted widget：12 个 TLD 的首年促销价（title-lg/title-sm span，HT）
 * 2. 详情页 /nom-de-domaine/tld/extension-{tld}/ 仅约 20 个 TLD 存在（其余 404），
 *    comparativeTable 三列面板 SSR 标准年价（行标签 "Tarif annuel ... hors promotion"）：
 *    widgetContainerAlias column1th2_price=注册 / column2th2_price=续费 / column3th2_price=转入，
 *    格式 <b><span class="euroPrice">19</span></b>,<span class="centsPrice">90</span> € HT
 * 3. Dada 框架 price widget fireWhen=userLogged：游客不触发 AJAX 刷新，
 *    SSR 初始内容即游客可见价格，无需浏览器/舰队/网关。
 * 4. search.amen.fr 搜索结果流受 recaptcha 保护，不在本适配器覆盖范围；
 *    详情页交叉链接（extension-xxx）自动扩展探测集合。
 * 5. 部分有价后缀（如 .co）无任何 SSR 入口链接，用平台热度榜 Top 100 补充探测；
 *    crawlScope.tlds 给定时（回填批次）改为只探测指定后缀。
 * 6. 促销价仅 highlighted 12 个 TLD 可得；详情页英雄区 "Seulement X €" 贴纸
 *    格式不稳定（com 页显示 0），不作为数据源。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const MAIN_URL = "https://www.amen.fr/nom-de-domaine/"
const EXTENSION_URL = (tld: string) => `https://www.amen.fr/nom-de-domaine/tld/extension-${tld}/`

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
}

function frNumber(s: string): number | null {
  const v = Number.parseFloat(s.replace(/\s/g, "").replace(",", "."))
  return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null
}

function extractColumnPrice(html: string, column: number): number | null {
  const alias = html.indexOf(`column${column}th2_price`)
  if (alias < 0) return null
  let end = html.length
  for (let c = 1; c <= 3; c++) {
    if (c === column) continue
    const next = html.indexOf(`column${c}th2_price`, alias + 1)
    if (next > 0 && next < end) end = next
  }
  const seg = html.slice(alias, Math.min(end, alias + 2500))
  const span = seg.match(/euroPrice">(\d+)<\/span><\/b>,<span class="centsPrice">(\d+)/)
  if (span) return frNumber(`${span[1]}.${span[2]}`)
  const plain = seg.match(/([\d,]+)\s*€/)
  return plain ? frNumber(plain[1]) : null
}

interface AmenPage {
  tld: string
  register: number | null
  renew: number | null
  transfer: number | null
  sourceUrl: string
}

async function fetchAmen(ctx: AdapterContext): Promise<string> {
  const mainRes = await ctx.fetch(MAIN_URL, { headers: BROWSER_HEADERS })
  if (!mainRes.ok) throw new Error(`amen 主页 HTTP ${mainRes.status}`)
  const mainHtml = await mainRes.text()

  let candidates = new Set<string>()
  for (const m of mainHtml.matchAll(/\/domains\/tld\/([a-z0-9-]+)\.html/gi)) {
    candidates.add(m[1].toLowerCase())
  }
  for (const m of mainHtml.matchAll(/extension-([a-z0-9-]+)\//gi)) {
    candidates.add(m[1].toLowerCase())
  }
  const scope = ctx.crawlScope
  if (scope?.tlds && scope.tlds.length > 0) {
    candidates = new Set(scope.tlds.map((t) => t.replace(/^\./, "").toLowerCase()))
  } else {
    const topN = scope?.topN ?? 100
    for (const t of (ctx.knownTldsRanked ?? []).slice(0, topN)) {
      candidates.add(t.toLowerCase())
    }
  }
  const promo = new Map<string, number>()
  const blocks = mainHtml.split(/<div class="col-md-3 col-sm-6 text-center marginBottom">/).slice(1)
  for (const b of blocks) {
    const tld = (b.match(/tld-title-block[^>]*>\.([a-z0-9.-]+)</i) || [])[1]?.toLowerCase()
    if (!tld) continue
    const big = b.match(
      /title-lg lineheight-xs bold">(\d+)<\/span><span class="title-sm lineheight-xs">,(\d+)/,
    )
    const plain = b.match(/priceBoxWidget[\s\S]{0,400}?([\d,]+)\s*€/)
    const p = big ? frNumber(`${big[1]}.${big[2]}`) : plain ? frNumber(plain[1]) : null
    if (p !== null) promo.set(tld, p)
  }

  const pages: AmenPage[] = []
  const queue = [...candidates]
  const seen = new Set(queue)
  let cursor = 0
  const workers = Array.from({ length: 4 }, async () => {
    while (cursor < queue.length) {
      const tld = queue[cursor++]
      try {
        const res = await ctx.fetch(EXTENSION_URL(tld), { headers: BROWSER_HEADERS })
        if (!res.ok) continue
        const html = await res.text()
        if (!html.includes("th2_price")) continue
        const page: AmenPage = {
          tld,
          register: extractColumnPrice(html, 1),
          renew: extractColumnPrice(html, 2),
          transfer: extractColumnPrice(html, 3),
          sourceUrl: EXTENSION_URL(tld),
        }
        if (page.register !== null) pages.push(page)
        for (const m of html.matchAll(/extension-([a-z0-9-]+)\//gi)) {
          const x = m[1].toLowerCase()
          if (!seen.has(x) && queue.length < 300) {
            seen.add(x)
            queue.push(x)
          }
        }
      } catch {
        // 单页失败跳过，其余 TLD 继续
      }
    }
  })
  await Promise.all(workers)

  return JSON.stringify({
    promo: [...promo.entries()].map(([tld, value]) => ({ tld, value })),
    pages,
  })
}

function parseAmen(raw: string): RawPrice[] {
  const data = JSON.parse(raw) as {
    promo: { tld: string; value: number }[]
    pages: AmenPage[]
  }
  const promo = new Map(data.promo.map((p) => [p.tld, p.value]))
  const out: RawPrice[] = []
  for (const page of data.pages) {
    const promoPrice = promo.get(page.tld)
    const hasPromo = promoPrice !== undefined && page.register !== null && promoPrice < page.register
    out.push({
      tld: page.tld,
      currency: "EUR",
      registerPrice: page.register,
      renewPrice: page.renew,
      transferPrice: page.transfer,
      promotionPrice: hasPromo ? promoPrice : null,
      promotion: hasPromo,
      billingPeriod: "1y",
      sourceUrl: page.sourceUrl,
    })
  }
  if (out.length === 0) throw new Error("amen 解析结果为空（页面结构可能已变化）")
  return out
}

export const amenAdapter = defineAdapter({
  slug: "amen",
  name: "Amen",
  website: "https://www.amen.fr",
  owner: "Data Team",
  version: "2.0.0",
  parserVersion: "2.0.0",
  currency: "EUR",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["EUR"] },
  rateLimit: { concurrency: 4, rpm: 60, retries: 2, timeoutMs: 30_000 },
  strategies: [
    {
      type: "html",
      url: MAIN_URL,
      fetch: fetchAmen,
      parse: parseAmen,
    },
  ],
})
