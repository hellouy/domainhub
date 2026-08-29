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
      type: "playwright",
      url: "https://www.hostinger.com/domain-name-search",
      browser: {
        extract: "api-fetch",
        waitForTimeoutMs: 25_000,
        apiFetch: {
          url: "https://www.hostinger.com/api-proxy/api/domain/tlds-pricing",
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
            authorization: "Bearer www.hostinger.com",
            origin: "https://www.hostinger.com",
            referer: "https://www.hostinger.com/domain-name-search",
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