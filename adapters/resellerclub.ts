/**
 * ResellerClub 适配器(Adapter SDK 2.0) — 官方 API 骨架
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源(等 Key 即用):
 * - ResellerClub API(https://httpapi.com) 域名经济价:
 *   GET /api/domains/economypricing.json 返回全部 TLD 的注册/续费/转入价。
 *   认证: auth-userid + api-key。
 *   测试环境(先验证): https://test.httpapi.com
 *
 * 凭证录入(/admin/credentials): type=api_key,
 *   values.token=<api-key>, values.secret=<auth-userid>
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const API_BASE = "https://httpapi.com"
const API_BASE_TEST = "https://test.httpapi.com"

export const resellerclubAdapter = defineAdapter({
  slug: "resellerclub",
  name: "ResellerClub",
  website: "https://www.resellerclub.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  priority: 30,
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    api: true,
    supportedCurrencies: ["USD"],
    supportedLanguages: ["en"],
  },
  rateLimit: { concurrency: 1, rpm: 10, retries: 2, timeoutMs: 60_000 },
  strategies: [
    {
      type: "private-api",
      url: `${API_BASE}/api/domains/economypricing.json`,
      async fetch(ctx) {
        const cred = await ctx.getCredential("api_key")
        const apiKey = cred?.values.token
        const authUserId = cred?.values.secret
        if (!apiKey || !authUserId) {
          throw new Error("ResellerClub 缺少代理商凭证。请在 /admin/credentials 录入 type=api_key(token=api-key, secret=auth-userid)")
        }
        const params = new URLSearchParams({ "auth-userid": authUserId, "api-key": apiKey })
        const res = await ctx.fetch(`${API_BASE}/api/domains/economypricing.json?${params.toString()}`, {
          headers: { Accept: "application/json" },
        })
        if (!res.ok) {
          throw new Error(`ResellerClub API HTTP ${res.status}(授权失败请用 test.httpapi.com + 测试 reseller 账号验证)`)
        }
        return res.text()
      },
      parse(raw: string): RawPrice[] {
        // economypricing.json 结构(契约待真实凭证核验):
        // { "moredetails": "0", "prices": { ".com": { "currency":"USD",
        //   "reseller": "12.99", "addonreseller": "..." , "category": ... } }, ... }
        const data = JSON.parse(raw) as {
          prices?: Record<string, Record<string, string>>
        }
        const pricesMap = data.prices ?? {}
        const num = (v: unknown): number | null => {
          if (v == null) return null
          const n = Number.parseFloat(String(v).replace(/[^\d.]/g, ""))
          return Number.isFinite(n) && n > 0 ? n : null
        }
        const prices: RawPrice[] = []
        for (const [tld, p] of Object.entries(pricesMap)) {
          const clean = tld.replace(/^\./, "").toLowerCase()
          if (!/^[a-z0-9.-]{2,}$/.test(clean)) continue
          const reg = num(p?.reseller) ?? num(p?.register) ?? num(p?.price)
          const renew = num(p?.renewreseller) ?? num(p?.renew)
          const transfer = num(p?.transferreseller) ?? num(p?.transfer)
          if (reg == null && renew == null && transfer == null) continue
          prices.push({ tld: clean, registerPrice: reg, renewPrice: renew, transferPrice: transfer, currency: (p?.currency ?? "USD").toUpperCase(), sourceUrl: `${API_BASE}/api/domains/economypricing.json` })
        }
        if (prices.length === 0) {
          throw new Error("ResellerClub 未映射出价格字段: 需用真实凭证核对 economypricing 的 reseller/renew/transfer 字段名并微调 parse")
        }
        return prices
      },
    },
  ],
})