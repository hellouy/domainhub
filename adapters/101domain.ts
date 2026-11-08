/**
 * 101domain 适配器
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源结论(2026-11-07 实测):
 * 1. 价格数据全量来自内部 JSON 服务 GET /price_list_service.json?o=<首字母>：
 *    字母浏览 a-z 共 26 个请求，并集覆盖全部 1712 个 TLD；
 *    o=popular(426)/newgtld(485)/business(550) 等分类均为其子集。
 * 2. 主流 26 家（.com/.net/...）另由 pricing.htm 的 POST e[]= 表单提供（价格页默认视图），
 *    字母浏览同样覆盖，此处作为保险重放一次（按 sld_name 去重）。
 * 3. 响应条目: {sld_name,page_url,duration,is_on_sale,registration_price,original_price,
 *    renew_price,transfer_price,transfer_list_price}；金额形如 "15.99 USD"。
 *    original_price 非空 = 当期注册促销（registration_price 为促销价）。
 * 4. 直连无 CF 挑战（200 application/json），纯 fetch 可采；
 *    保留原 playwright 双页方案作降级兜底（舰队健康时自动走直采）。
 */
import { defineAdapter, browserRender, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const PRICING_URL = "https://www.101domain.com/pricing.htm"
const GTLD_URL = "https://www.101domain.com/new_gtld_extensions.htm"
const PRICE_API = "https://www.101domain.com/price_list_service.json"

/** pricing.htm 默认视图的主流 TLD（priceListExtensions 同款清单，字母浏览覆盖时的保险） */
const MAINSTREAM = ".com,.net,.org,.info,.co,.fr,.in,.it,.jp,.law,.life,.london,.ltd,.mobi,.mx,.nl,.nyc,.nz,.pl,.pro,.realty,.red,.ru,.se,.tw,.uk,.us".split(",")

interface PriceEntry {
  sld_name?: string
  duration?: number
  is_on_sale?: string
  registration_price?: string
  original_price?: string
  renew_price?: string
  transfer_price?: string
  transfer_list_price?: string
  page_url?: string
}

const amt = (s: string | undefined): number | null => {
  const m = (s ?? "").match(/([\d,]+\.\d{2})/)
  if (!m) return null
  const v = Number.parseFloat(m[1].replace(/,/g, ""))
  return Number.isFinite(v) && v > 0 && v < 1000000 ? Math.round(v * 100) / 100 : null
}

async function fetchDirect(ctx: AdapterContext): Promise<string> {
  const headers = {
    Referer: PRICING_URL,
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  }
  const byTld = new Map<string, PriceEntry>()
  const merge = (entries: PriceEntry[]) => {
    for (const e of entries) {
      if (e?.sld_name && !byTld.has(e.sld_name)) byTld.set(e.sld_name, e)
    }
  }
  // 字母浏览 a-z：全量目录
  for (const ch of "abcdefghijklmnopqrstuvwxyz") {
    const res = await ctx.fetch(`${PRICE_API}?o=${ch}`, { headers, signal: AbortSignal.timeout(20_000) })
    if (!res.ok) throw new Error(`101domain 字母 ${ch} 返回 HTTP ${res.status}`)
    const j = (await res.json()) as { data?: PriceEntry[] }
    merge(j?.data ?? [])
  }
  // 主流清单保险：pricing.htm 默认 POST e[]= 表单
  const page = await ctx.fetch(PRICING_URL, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(20_000) })
  const pageText = await page.text()
  const extMatch = pageText.match(/priceListExtensions\s*=\s*"([^"]+)"/)
  const exts = extMatch?.[1]?.split(",").filter(Boolean) ?? MAINSTREAM
  const body = exts.map((e) => `e[]=${encodeURIComponent(e)}`).join("&")
  const res = await ctx.fetch(`${PRICE_API}?o=`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body,
    signal: AbortSignal.timeout(20_000),
  })
  if (res.ok) {
    const j = (await res.json()) as { data?: PriceEntry[] }
    merge(j?.data ?? [])
  }
  return JSON.stringify([...byTld.values()])
}

function parseDirect(raw: string): RawPrice[] {
  const entries = JSON.parse(raw) as PriceEntry[]
  const prices: RawPrice[] = []
  const seen = new Set<string>()
  for (const e of entries) {
    const tld = (e.sld_name ?? "").replace(/^\./, "").toLowerCase()
    if (!tld || !/^[a-z0-9][a-z0-9.-]*$/.test(tld) || seen.has(tld)) continue
    const list = amt(e.original_price)
    const current = amt(e.registration_price)
    if (list == null && current == null) continue
    const registerPrice = list ?? current
    const promotionPrice = list != null && current != null && current < list ? current : null
    const renewPrice = amt(e.renew_price)
    const transferPrice = amt(e.transfer_price)
    if (registerPrice == null && renewPrice == null && transferPrice == null) continue
    seen.add(tld)
    prices.push({
      tld,
      currency: "USD",
      registerPrice,
      renewPrice,
      transferPrice,
      promotionPrice,
      promotion: promotionPrice != null,
      billingPeriod: "1y",
      sourceUrl: e.page_url ?? PRICING_URL,
    })
  }
  if (prices.length < 100) throw new Error(`101domain 直采行数异常: ${prices.length}（字母浏览覆盖可能已变化）`)
  return prices
}

export const domain101Adapter = defineAdapter({
  slug: "101domain",
  name: "101domain",
  website: "https://www.101domain.com",
  version: "2.0.0",
  parserVersion: "2.0.0",
  owner: "Data Team",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["USD"] },
  rateLimit: { concurrency: 2, rpm: 30, retries: 2, timeoutMs: 30_000 },
  strategies: [
    {
      type: "xhr",
      url: `${PRICE_API}?o=<letter>`,
      fetch: fetchDirect,
      parse: parseDirect,
    },
    {
      type: "playwright",
      url: PRICING_URL,
      async fetch(ctx) {
        const out: unknown[] = []
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
        // 101domain 对连续浏览器请求限流（Cloudflare 间歇 502/空页），加大重试间隔
        const pricingScript = (() => {
          return `(() => {
            const out = []
            for (const el of document.querySelectorAll('li.pricelist-row')) {
              const link = el.querySelector('.pricelist-row--link')
              const tldRaw = (link?.textContent || '').trim().replace(/^\\./,'').toLowerCase()
              if (!/^[a-z0-9-]{2,20}(?:\\.[a-z0-9-]{2,15}){0,2}$/.test(tldRaw)) continue
              const parseV = (sel) => {
                const n = el.querySelector(sel)
                const t = (n?.textContent || '').replace(/[^0-9.,]/g,'').trim()
                if (!t) return null
                const v = parseFloat(t.replace(/,/g,''))
                return Number.isFinite(v) && v > 0 && v < 1000000 ? Math.round(v*100)/100 : null
              }
              out.push({ tld: tldRaw, register: parseV('.price-current'), renew: parseV('.price-renew'), transfer: parseV('.price-transfer') })
            }
            return JSON.stringify(out)
          })()`
        })()
        for (const u of [PRICING_URL, GTLD_URL]) {
          let extracted: unknown[] | null = null
          let lastErr = ""
          for (let attempt = 0; attempt < 4 && extracted === null; attempt++) {
            if (attempt > 0) await sleep(8_000)
            try {
              const data = await browserRender(
                {
                  url: u,
                  extract: "extract-json",
                  waitForTimeoutMs: 25_000,
                  ...(u === PRICING_URL ? { script: pricingScript } : {}),
                },
              )
              if (data.ok && Array.isArray(data.extracted) && data.extracted.length > 0) extracted = data.extracted
              else lastErr = data.error ?? "渲染成功但命中为空"
            } catch (e) {
              lastErr = e instanceof Error ? e.message : String(e)
            }
          }
          if (extracted === null) throw new Error(lastErr || "浏览器渲染失败")
          out.push(...extracted)
          await sleep(2_500)
        }
        return JSON.stringify(out)
      },
      parse(raw): Array<{
        tld: string
        registerPrice: number | null
        renewPrice: number | null
        transferPrice: number | null
      }> {
        const rows = JSON.parse(raw) as Array<{
          tld?: string
          registerPrice?: number | null
          renewPrice?: number | null
          transferPrice?: number | null
        }>
        const out: Array<{ tld: string; registerPrice: number | null; renewPrice: number | null; transferPrice: number | null }> = []
        for (const r of rows) {
          if (!r.tld) continue
          // 主流表（有真实续费/转入价）里的登记价为促销，清空；新 gTLD 表仅注册价，保留
          if (r.renewPrice != null || r.transferPrice != null) {
            out.push({ tld: r.tld, registerPrice: null, renewPrice: r.renewPrice ?? null, transferPrice: r.transferPrice ?? null })
          } else {
            out.push({ tld: r.tld, registerPrice: r.registerPrice ?? null, renewPrice: null, transferPrice: null })
          }
        }
        return out
      },
    },
  ],
})
