/**
 * West.cn 适配器（西部数码）
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源结论(2026-11-07 实测):
 * 1. 价格页 /web/price/domainpricelist 为 Vue+Element UI 应用，但价表数据由服务端内嵌：
 *    HTML 中存在全局变量 enData = JSON.parse('[...]')（英文 TLD 表，118 条），
 *    另有 cnData（中文域名表）。直连 GET 无任何反爬（无 Cloudflare）。
 * 2. 单条结构: {suffix, oldprice, buy:{等级:{年限:价}}, renew:{...}, turnprice:{buyprice,buyprice_pro}}
 *    buy/renew 按用户等级("1"=普通用户)与年限("1"/"3"/"5"/"10")；单位 CNY。
 * 3. 映射（与 DB 现存 118 行逐字段对齐）:
 *    registerPrice = oldprice（标准价，缺失回退 buy 1 年价）
 *    promotionPrice = buy["1"]["1"] 当严格小于 oldprice（110 行促销，与 DB 一致）
 *    renewPrice = renew["1"]["1"]
 *    transferPrice = turnprice.buyprice（114 条有值，4 条无转移价）
 * 4. 零浏览器依赖（原 playwright + extract-json 自定义脚本方案废弃）。
 */
import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"
import { validatePrices } from "@/packages/adapter-sdk/validation"

const PAGE_URL = "https://www.west.cn/web/price/domainpricelist"

const num = (v: unknown): number | null => {
  if (v == null) return null
  const n = Number(typeof v === "string" ? v.replace(/[\s,]/g, "") : v)
  return Number.isFinite(n) && n > 0 && n < 1000000 ? Math.round(n * 100) / 100 : null
}

interface WestEntry {
  suffix?: string
  oldprice?: string
  buy?: Record<string, Record<string, string>>
  renew?: Record<string, Record<string, string>>
  turnprice?: { buyprice?: string; buyprice_pro?: string }
}

async function fetchWestcn(ctx: AdapterContext): Promise<string> {
  const res = await ctx.fetch(PAGE_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      Referer: "https://www.west.cn/",
    },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`westcn 页面返回 HTTP ${res.status}`)
  return res.text()
}

function parseWestcn(raw: string): RawPrice[] {
  const m = raw.match(/enData\s*=\s*JSON\.parse\('([^']*)'\)/)
  if (!m) throw new Error("westcn 页面未找到 enData 内嵌价表（页面结构可能已变化）")
  let entries: WestEntry[]
  try {
    entries = JSON.parse(m[1]) as WestEntry[]
  } catch {
    throw new Error("westcn enData JSON 解析失败")
  }
  const prices: RawPrice[] = []
  const seen = new Set<string>()
  for (const e of entries) {
    const tld = (e.suffix ?? "").replace(/^\./, "").toLowerCase()
    if (!tld || !/^[a-z0-9][a-z0-9.-]*$/.test(tld) || seen.has(tld)) continue
    const register = num(e.oldprice) ?? num(e.buy?.["1"]?.["1"])
    const buy1 = num(e.buy?.["1"]?.["1"])
    const renew = num(e.renew?.["1"]?.["1"])
    const transfer = num(e.turnprice?.buyprice)
    if (register == null && renew == null && transfer == null) continue
    const promotionPrice = register != null && buy1 != null && buy1 < register ? buy1 : null
    seen.add(tld)
    prices.push({
      tld,
      currency: "CNY",
      registerPrice: register,
      renewPrice: renew,
      transferPrice: transfer,
      promotionPrice,
      promotion: promotionPrice != null,
      billingPeriod: "1y",
      sourceUrl: PAGE_URL,
    })
  }
  if (prices.length < 50) throw new Error(`westcn enData 解析行数异常: ${prices.length}`)
  return prices
}

export const westcnAdapter = defineAdapter({
  slug: "westcn",
  name: "West.cn（西部数码）",
  website: "https://www.west.cn",
  version: "3.0.0",
  parserVersion: "3.0.0",
  owner: "Data Team",
  currency: "CNY",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["CNY"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 2, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: PAGE_URL,
      fetch: fetchWestcn,
      parse: parseWestcn,
    },
  ],
  hooks: {
    async validate(prices) {
      return validatePrices(prices, "CNY")
    },
  },
})
