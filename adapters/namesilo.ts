/**
 * NameSilo 适配器(Adapter SDK 2.0)— 官方 API,等 Key 即用
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源结论(2026-07):
 * 1. private-api: 官方 getPrices 接口, 一次返回全量 TLD 定价(USD)。
 *    免费注册 NameSilo 账户 → API Manager 生成 Key。
 *    凭证录入(/admin/credentials): type=api_key, values.token=<API Key>
 * 2. html: www.namesilo.com/pricing 被 Cloudflare 盾拦截, 不可用。
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const API_BASE = "https://www.namesilo.com/api/getPrices"

interface NameSiloTldEntry {
  registration?: string
  renew?: string
  transfer?: string
}

export const namesiloAdapter = defineAdapter({
  slug: "namesilo",
  name: "NameSilo",
  website: "https://www.namesilo.com",
  owner: "Data Team",
  version: "2.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  priority: 30,
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    whoisPrivacy: true,
    api: true,
    bulkSearch: true,
    affiliate: true,
    marketplace: true,
    supportedCurrencies: ["USD"],
    supportedLanguages: ["en"],
  },
  rateLimit: { concurrency: 1, rpm: 10, retries: 2, timeoutMs: 60_000 },
  hooks: {
    async initialize(ctx) {
      const cred = await ctx.getCredential("api_key")
      if (!cred?.values.token) {
        throw new Error(
          "NameSilo 缺少 API Key。请在 /admin/credentials 为 namesilo 录入 type=api_key 凭证(免费: namesilo.com → API Manager)",
        )
      }
    },
  },
  strategies: [
    {
      type: "private-api",
      url: API_BASE,
      async fetch(ctx) {
        const cred = await ctx.getCredential("api_key")
        const key = cred?.values.token ?? ""
        const url = `${API_BASE}?version=1&type=json&key=${encodeURIComponent(key)}`
        const res = await ctx.fetch(url, { headers: { Accept: "application/json" } })
        if (!res.ok) throw new Error(`NameSilo API 返回 HTTP ${res.status}`)
        return res.text()
      },
      async parse(raw): Promise<RawPrice[]> {
        const data = JSON.parse(raw) as { reply?: Record<string, unknown> }
        const reply = data.reply
        if (!reply) throw new Error("NameSilo API 响应缺少 reply 字段")
        const code = String(reply.code ?? "")
        if (code !== "300") {
          throw new Error(`NameSilo API 错误: code=${code} detail=${String(reply.detail ?? "")}`)
        }
        const prices: RawPrice[] = []
        for (const [key, value] of Object.entries(reply)) {
          // reply 中除 code/detail 外, 每个键是一个 TLD(可能带点)
          if (key === "code" || key === "detail" || typeof value !== "object" || value === null) continue
          const entry = value as NameSiloTldEntry
          if (!entry.registration && !entry.renew && !entry.transfer) continue
          prices.push({
            tld: key.replace(/^\./, ""),
            registerPrice: entry.registration ?? null,
            renewPrice: entry.renew ?? null,
            transferPrice: entry.transfer ?? null,
            currency: "USD",
            sourceUrl: "https://www.namesilo.com/api-reference#general/get-prices",
          })
        }
        if (prices.length === 0) throw new Error("NameSilo API 未返回任何 TLD 定价")
        return prices
      },
    },
  ],
})
