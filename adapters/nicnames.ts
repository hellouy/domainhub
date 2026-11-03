/**
 * NicNames.com —— 官网 Next.js 水合数据 + 产品定价 API
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源(2026-11-03 重构, 两阶段):
 *   1. GET https://nicnames.com/en/domains/prices (SSR HTML)
 *      页面 __NEXT_DATA__.props.pageProps.domainNames.domainNames 内嵌全量
 *      632 条 {domain, code(punycode), productId, registrationEnabled}
 *   2. GET https://nicnames.com/api/product/pricing?ids=<productId, 20 个/批>
 *      返回定价记录数组: {operation, periodDuration, currency, amount,
 *      initialAmount, productId, userGroup}; amount 单位为分(美分)
 *      CREATE=注册 RENEW=续费 TRANSFER=转移, 取 periodDuration=1 的记录
 * 旧端点 /api/domains/registrar-prices 已失效(HTTP 500 "Failed to fetch
 * registrar prices", 其上游聚合故障), 本适配器弃用该端点。
 * 验证: .com CREATE amount=1097 → $10.97; 全量 393 个可注册 TLD。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const PAGE_URL = "https://nicnames.com/en/domains/prices"
const PRICING_API = "https://nicnames.com/api/product/pricing"
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36"
const CHUNK = 20

interface DomainNameEntry {
  domain: string
  code?: string
  productId: string
  registrationEnabled?: boolean
}

/** 阶段 1: SSR 页面取 __NEXT_DATA__ 水合数据; 阶段 2: 分批拉定价 API, 拼成 JSON 交给 parse */
async function fetchNicnames(ctx: AdapterContext): Promise<string> {
  const page = await ctx.fetch(PAGE_URL, { headers: { "User-Agent": UA } })
  if (!page.ok) throw new Error(`nicnames 价格页返回 HTTP ${page.status}`)
  const html = await page.text()
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!m) throw new Error("nicnames 页面缺少 __NEXT_DATA__ 水合数据")
  const next = JSON.parse(m[1]) as { props?: { pageProps?: { domainNames?: { domainNames?: DomainNameEntry[] } } } }
  const names = next?.props?.pageProps?.domainNames?.domainNames ?? []
  if (names.length < 100) throw new Error(`nicnames 水合数据域数异常: ${names.length}`)
  const productIds = names.filter((n) => n.registrationEnabled && n.productId).map((n) => n.productId)
  if (productIds.length < 100) throw new Error(`nicnames 可注册产品数异常: ${productIds.length}`)
  const records: unknown[] = []
  for (let i = 0; i < productIds.length; i += CHUNK) {
    const chunk = productIds.slice(i, i + CHUNK)
    const res = await ctx.fetch(`${PRICING_API}?ids=${chunk.join(",")}`, { headers: { "User-Agent": UA } })
    if (!res.ok) throw new Error(`nicnames 定价 API 返回 HTTP ${res.status}`)
    const data = JSON.parse(await res.text())
    if (Array.isArray(data)) records.push(...data)
    if (i + CHUNK < productIds.length) await new Promise((r) => setTimeout(r, 200))
  }
  if (records.length < 100) throw new Error(`nicnames 定价记录数异常: ${records.length}`)
  return JSON.stringify({ names, records })
}

/** 定价记录按产品聚合(CREATE/RENEW/TRANSFER, 1 年期, amount 单位为分) */
function parseNicnames(raw: string): RawPrice[] {
  const { names, records } = JSON.parse(raw) as {
    names: DomainNameEntry[]
    records: Array<{
      operation?: string
      periodDuration?: number
      userGroup?: string
      amount?: number
      productId?: string
    }>
  }
  const byProduct = new Map<string, { create?: number; renew?: number; transfer?: number }>()
  for (const r of records) {
    if (r.periodDuration !== 1 || r.userGroup !== "price_group_1") continue
    const amt = typeof r.amount === "number" && r.amount > 0 ? r.amount : null
    if (amt == null) continue
    const pid = String(r.productId)
    const entry = byProduct.get(pid) ?? {}
    if (r.operation === "CREATE") entry.create = amt
    else if (r.operation === "RENEW") entry.renew = amt
    else if (r.operation === "TRANSFER") entry.transfer = amt
    byProduct.set(pid, entry)
  }
  const out: RawPrice[] = []
  const seen = new Set<string>()
  for (const n of names) {
    if (!n.registrationEnabled) continue
    const tld = String(n.code || n.domain).toLowerCase().replace(/^\./, "")
    if (!tld || seen.has(tld)) continue
    const p = byProduct.get(String(n.productId))
    if (!p || p.create == null) continue
    seen.add(tld)
    const price: RawPrice = { tld, currency: "USD", sourceUrl: PAGE_URL }
    price.registerPrice = p.create / 100
    if (p.renew != null) price.renewPrice = p.renew / 100
    if (p.transfer != null) price.transferPrice = p.transfer / 100
    out.push(price)
  }
  if (out.length < 100) throw new Error(`nicnames 解析结果异常: ${out.length}(页面结构可能已变化)`)
  return out
}

export const nicnamesAdapter = defineAdapter({
  slug: "nicnames",
  name: "NicNames.com",
  website: "https://nicnames.com",
  owner: "Data Team",
  version: "2.0.0",
  parserVersion: "2.0.0",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["USD"] },
  rateLimit: { concurrency: 1, rpm: 30, retries: 2, timeoutMs: 120_000 },
  strategies: [
    {
      type: "api",
      url: PAGE_URL,
      fetch: fetchNicnames,
      parse: parseNicnames,
    },
  ],
})
