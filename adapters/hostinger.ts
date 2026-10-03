/**
 * Hostinger 适配器
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 域名价格页为 SPA，价格经 `/api-proxy/api/domain/tlds-pricing` 接口获取。
 * 接口需会话 cookie + 鉴权头 `authorization: Bearer www.hostinger.com`，
 * 通过 browser-worker 的 api-fetch 形态（同 context 页面内 fetch 重放，
 * cookie 自动携带）+ tlds 批量请求全量取价。
 * 自定义 parse 仅提取真实续费/转入价（促销注册价清空）。
 */
import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const API_URL = "https://www.hostinger.com/api-proxy/api/domain/tlds-pricing"
const SEARCH_URL = "https://www.hostinger.com/domain-name-search"
const HOSTINGER_TLDS = [
  ".com", ".net", ".org", ".info", ".biz", ".io", ".ai", ".co",
  ".app", ".dev", ".tech", ".site", ".online", ".store", ".shop", ".space",
  ".pro", ".live", ".news", ".media", ".digital", ".design", ".studio", ".agency",
  ".group", ".network", ".company", ".services", ".solutions", ".systems", ".plus",
  ".fun", ".icu", ".link", ".website", ".press", ".monster", ".email", ".marketing",
  ".technology", ".management", ".consulting", ".international", ".photography",
  ".software", ".world", ".today", ".club", ".top", ".vip", ".xyz", ".one",
  ".cloud", ".host", ".pizza", ".guru", ".expert", ".life", ".blog", ".social",
  ".academy", ".buzz", ".energy", ".finance", ".investments", ".ventures",
  ".events", ".gallery", ".lifestyle", ".solutions", ".training", ".wedding",
  ".company", ".team", ".works", ".zone", ".center", ".directory", ".domains",
  ".gift", ".guide", ".institute", ".media", ".pro", ".rentals", ".sale",
  ".show", ".sun", ".supplies", ".support", ".tips", ".video", ".wine",
  ".asia", ".cc", ".me", ".tv", ".com.au", ".de", ".es", ".fr", ".it",
  ".nl", ".pl", ".pt", ".co.uk", ".com.mx", ".com.br", ".com.tr", ".in",
  ".cn", ".com.cn", ".com.tw", ".jp", ".co.jp", ".kr", ".co.kr", ".hk",
  ".com.hk", ".sg", ".com.sg", ".my", ".com.my", ".th", ".vn", ".com.vn",
  ".id", ".co.id", ".ph", ".com.ph",
]

interface HostingerPriceEntry {
  product?: {
    price?: {
      old?: number | null
      purchase?: number | null
      renew?: number | null
      transfer?: number | null
      first_year_price?: number | null
    }
  }
}

/** 把已知 TLD 集合并进候选列表（Hostinger 端点只回它支持的后缀） */
function candidateTlds(ctx: { knownTlds: Set<string> }): string[] {
  const set = new Set<string>(HOSTINGER_TLDS)
  for (const tld of ctx.knownTlds ?? []) {
    const t = tld.trim().toLowerCase()
    if (t) set.add(t.startsWith(".") ? t : `.${t}`)
  }
  return Array.from(set)
}

export const hostingerAdapter = defineAdapter({
  slug: "hostinger",
  name: "Hostinger",
  website: "https://www.hostinger.com",
  version: "1.1.0",
  parserVersion: "1.0.0",
  owner: "Data Team",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["USD"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 2, timeoutMs: 120_000 },
  strategies: [
    {
      // 首选：xhr 直连 hostinger 定价端点（无需浏览器会话），用已知 TLD 全集批量取价
      type: "xhr",
      url: API_URL,
      async fetch(ctx) {
        const res = await ctx.fetch(API_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
            authorization: "Bearer www.hostinger.com",
            origin: "https://www.hostinger.com",
            referer: SEARCH_URL,
          },
          body: JSON.stringify({ tlds: candidateTlds(ctx), currency_code: "USD" }),
        })
        if (!res.ok) throw new Error(`Hostinger tlds-pricing 返回 HTTP ${res.status}`)
        return res.text()
      },
      parse(raw: string): RawPrice[] {
        const data = (JSON.parse(raw).data ?? {}) as Record<string, HostingerPriceEntry>
        const prices: RawPrice[] = []
        for (const [tldKey, entry] of Object.entries(data)) {
          const price = entry.product?.price
          if (!price) continue
          const tld = tldKey.replace(/^\./, "").toLowerCase()
          const register = Number(price.old ?? price.purchase)
          const purchase = Number(price.purchase ?? 0)
          const promotion = Number.isFinite(register) && Number.isFinite(purchase) && purchase < register
          prices.push({
            tld,
            registerPrice: Number.isFinite(register) && register > 0 ? register : null,
            renewPrice: price.renew ?? null,
            transferPrice: price.transfer ?? null,
            currency: "USD",
            promotion,
            sourceUrl: SEARCH_URL,
          })
        }
        if (prices.length === 0) throw new Error("Hostinger tlds-pricing 返回为空")
        return prices
      },
    },
    {
      type: "playwright",
      url: SEARCH_URL,
      browser: {
        extract: "api-fetch",
        waitForTimeoutMs: 25_000,
        apiFetch: {
          url: API_URL,
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
            authorization: "Bearer www.hostinger.com",
            origin: "https://www.hostinger.com",
            referer: SEARCH_URL,
          },
          body: { tlds: HOSTINGER_TLDS, currency_code: "USD" },
        },
      },
      parse: async (raw: string): Promise<RawPrice[]> => {
        const data = (JSON.parse(raw).data ?? {}) as Record<
          string,
          { product?: { price?: { renew?: number | null; transfer?: number | null } } }
        >
        return Object.keys(data).map((tld) => ({
          tld: tld.replace(/^\./, ""),
          registerPrice: null,
          renewPrice: data[tld]?.product?.price?.renew ?? null,
          transferPrice: data[tld]?.product?.price?.transfer ?? null,
        }))
      },
    },
  ],
})