/**
 * Hostinger 适配器
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 域名价格页为 SPA，价格经 `/api-proxy/api/domain/tlds-pricing` XHR 获取。
 * 通过 browser-worker 的 xhr-json 捕获接口响应（BROWSER_SERVICE_URL），
 * 自定义 parse 仅提取真实续费/转入价（促销注册价清空）。
 */
import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

export const hostingerAdapter = defineAdapter({
  slug: "hostinger",
  name: "Hostinger",
  website: "https://www.hostinger.com",
  version: "1.0.0",
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
        extract: "xhr-json",
        captureXhrFilter: ["tlds-pricing"],
        waitForTimeoutMs: 25_000,
      },
      parse: async (raw: string): Promise<RawPrice[]> => {
        const list = JSON.parse(raw) as Array<{ url: string; status: number; body: string }>
        const hit = list.find((r) => r.url.includes("tlds-pricing"))
        if (!hit) throw new Error("未捕获 tlds-pricing 定价接口响应")
        const data = (JSON.parse(hit.body).data ?? {}) as Record<
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