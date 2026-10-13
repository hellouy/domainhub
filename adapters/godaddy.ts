/**
 * GoDaddy 适配器(Adapter SDK 2.0)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源(按优先级):
 * 1. private-api: GoDaddy 开发者 API(developer.godaddy.com, 免费申请 Key/Secret)。
 *    GoDaddy 无批量价格表接口, 采用两步法:
 *    GET /v1/domains/tlds 取支持的后缀 → POST /v1/domains/available(批量 500/次)
 *    用随机不存在的标签探测每个后缀的注册价(响应含 price 微单位 + currency)。
 *    仅能取注册价; 续费/转入价 API 不提供, 置 null。
 *    凭证录入(/admin/credentials): type=api_key,
 *      values.token=<Key>, values.secret=<Secret>
 *    若报 403 可先用 OTE Key 验证连通性。
 * 2. html: se.godaddy.com DDC 折扣俱乐部页(anti-bot 聚合渲染)。
 *    页面 "See All 558 Extensions" 全量数据在 __NEXT_DATA__ domains 数组,
 *    取「普通价格列」listPrice(GoDaddys ordinarie pris)作 register/renew/transfer。
 *    raw 微单位(1 SEK = 1,000,000), 货币 SEK。
 *    无 API 凭证时自动降级此策略, 覆盖 558 后缀注册/续费/转入价。
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"
import { validatePrices } from "@/packages/adapter-sdk"

const API_BASE = "https://api.godaddy.com"
const DDC_URL = "https://se.godaddy.com/domains/discount-domain-club"
/** 随机不存在的域名标签, 用于探测注册价 */
const PROBE_LABEL = "dhx7q0zk4v1probe"
const MICRO = 1_000_000

interface GoDaddyAvailability {
  domain?: string
  available?: boolean
  price?: number
  currency?: string
}

interface GdDdcPrice {
  raw?: number
  formatted?: string
}
interface GdDdcRow {
  tld?: string
  pricesByType?: Record<
    "registration" | "renewal" | "transfer",
    { listPrice?: GdDdcPrice; basicPrice?: GdDdcPrice }
  >
}

/** 从 DDC 页 __NEXT_DATA__ 提取全部后缀, 普通价格列 listPrice */
function parseDdcNextData(raw: string): RawPrice[] {
  const m = raw.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
  if (!m) return []
  let str: string
  try {
    str = JSON.stringify(JSON.parse(m[1]))
  } catch {
    return []
  }
  const idx = str.search(/"domains"\s*:\s*\[\{"tld"/)
  if (idx < 0) return []
  let i = str.indexOf("[", idx)
  let depth = 0
  let inStr = false
  let esc = false
  let end = -1
  while (i < str.length) {
    const ch = str[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === "\\") esc = true
      else if (ch === '"') inStr = false
    } else {
      if (ch === '"') inStr = true
      else if (ch === "[") depth += 1
      else if (ch === "]") {
        depth -= 1
        if (depth === 0) {
          end = i + 1
          break
        }
      }
    }
    i++
  }
  if (end < 0) return []
  let rows: GdDdcRow[]
  try {
    rows = JSON.parse(str.slice(str.indexOf("[", idx), end)) as GdDdcRow[]
  } catch {
    return []
  }
  const prices: RawPrice[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const tld = String(row.tld ?? "").trim().toLowerCase().replace(/^\./, "")
    if (!tld || seen.has(tld)) continue
    const pt = row.pricesByType
    if (!pt) continue
    const toPrice = (v: GdDdcPrice | undefined): number | null => {
      if (!v || typeof v.raw !== "number" || v.raw <= 0) return null
      return Math.round((v.raw / MICRO) * 100) / 100
    }
    const reg = toPrice(pt.registration?.listPrice)
    const renew = toPrice(pt.renewal?.listPrice)
    const transfer = toPrice(pt.transfer?.listPrice)
    if (reg == null && renew == null && transfer == null) continue
    seen.add(tld)
    const p: RawPrice = { tld, currency: "SEK", sourceUrl: DDC_URL }
    if (reg != null) p.registerPrice = reg
    if (renew != null) p.renewPrice = renew
    if (transfer != null) p.transferPrice = transfer
    prices.push(p)
  }
  return prices
}

export const godaddyAdapter = defineAdapter({
  slug: "godaddy",
  name: "GoDaddy",
  website: "https://www.godaddy.com",
  owner: "Data Team",
  version: "2.0.0",
  parserVersion: "1.1.0",
  currency: "USD",
  priority: 25,
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    whoisPrivacy: true,
    dnssec: true,
    api: true,
    bulkSearch: true,
    affiliate: true,
    marketplace: true,
    supportedCurrencies: ["USD", "SEK"],
    supportedLanguages: ["en", "sv"],
  },
  rateLimit: { concurrency: 1, rpm: 50, retries: 2, timeoutMs: 60_000 },
  hooks: {
    async initialize(ctx) {
      // 无 API 凭证不阻塞采集: 降级用 DDC 页面(anti-bot)策略
      const cred = await ctx.getCredential("api_key")
      if (!cred?.values.token || !cred?.values.secret) {
        await ctx.log("warn", "GoDaddy 缺少 API 凭证, 降级采集 DDC 折扣页(se.godaddy.com)")
      }
    },
    // 默认校验按 definition.currency(USD) 强制币种一致, 但 DDC 策略产出真实 SEK 价。
    // 按行实际币种分组, 各组用自身币种走同一套校验(负价/空行/重复/离群/突变)。
    async validate(prices, ctx) {
      const byCurrency = new Map<string, typeof prices>()
      for (const p of prices) {
        const cur = p.currency ?? "USD"
        byCurrency.set(cur, [...(byCurrency.get(cur) ?? []), p])
      }
      const out: Awaited<ReturnType<typeof validatePrices>> = []
      for (const [cur, list] of byCurrency) {
        out.push(...validatePrices(list, cur))
      }
      return out
    },
  },
  strategies: [
    {
      type: "private-api",
      url: `${API_BASE}/v1/domains/tlds`,
      async fetch(ctx) {
        const cred = await ctx.getCredential("api_key")
        const auth = {
          Authorization: `sso-key ${cred?.values.token ?? ""}:${cred?.values.secret ?? ""}`,
          Accept: "application/json",
        }

        // 1. 取支持的 TLD 列表
        const tldRes = await ctx.fetch(`${API_BASE}/v1/domains/tlds`, { headers: auth })
        if (!tldRes.ok) {
          throw new Error(`GoDaddy TLD 列表接口 HTTP ${tldRes.status}(401/403 = Key 无效或权限不足)`)
        }
        const tldJson = (await tldRes.json()) as Array<{ name?: string; type?: string }>
        const tlds = tldJson
          .map((t) => String(t.name ?? "").toLowerCase())
          .filter((t) => /^[a-z0-9.-]{2,}$/.test(t))
        if (tlds.length === 0) throw new Error("GoDaddy TLD 列表为空")
        await ctx.log("info", `GoDaddy: 共 ${tlds.length} 个后缀, 分批探测注册价(500/批)`)

        // 2. 批量探测注册价(500 域名/次)
        const all: GoDaddyAvailability[] = []
        for (let i = 0; i < tlds.length; i += 500) {
          const batch = tlds.slice(i, i + 500).map((t) => `${PROBE_LABEL}.${t}`)
          const res = await ctx.fetch(`${API_BASE}/v1/domains/available?checkType=FAST`, {
            method: "POST",
            headers: { ...auth, "Content-Type": "application/json" },
            body: JSON.stringify(batch),
          })
          if (!res.ok) {
            await ctx.log("warn", `GoDaddy 批量查询第 ${i / 500 + 1} 批失败 HTTP ${res.status}, 跳过`)
            continue
          }
          const json = (await res.json()) as { domains?: GoDaddyAvailability[] }
          if (Array.isArray(json.domains)) all.push(...json.domains)
        }
        if (all.length === 0) throw new Error("GoDaddy 批量可用性查询未返回任何结果")
        return JSON.stringify(all)
      },
      async parse(raw): Promise<RawPrice[]> {
        const rows = JSON.parse(raw) as GoDaddyAvailability[]
        const prices: RawPrice[] = []
        for (const row of rows) {
          if (!row.domain || !row.available || typeof row.price !== "number" || row.price <= 0) continue
          const tld = row.domain.slice(row.domain.indexOf(".") + 1).toLowerCase()
          prices.push({
            tld,
            // price 为微单位(1 USD = 1,000,000)
            registerPrice: Math.round((row.price / 1_000_000) * 100) / 100,
            renewPrice: null,
            transferPrice: null,
            currency: (row.currency ?? "USD").toUpperCase(),
            sourceUrl: "https://developer.godaddy.com/doc/endpoint/domains",
          })
        }
        if (prices.length === 0) throw new Error("GoDaddy 未解析出任何注册价")
        return prices
      },
    },
    {
      type: "anti-bot",
      url: DDC_URL,
      antiBot: { keyword: "Förnyas för" },
      async parse(raw: string): Promise<RawPrice[]> {
        const prices = parseDdcNextData(raw)
        if (prices.length === 0) throw new Error("GoDaddy DDC 页未解析出任何价格")
        return prices
      },
    },
  ],
})
