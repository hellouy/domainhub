/**
 * GoDaddy 适配器(Adapter SDK 2.0)— 官方 API,等 Key 即用
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源结论(2026-07):
 * 1. private-api: GoDaddy 开发者 API(developer.godaddy.com, 免费申请 Key/Secret)。
 *    GoDaddy 无批量价格表接口, 采用两步法:
 *    GET /v1/domains/tlds 取支持的后缀 → POST /v1/domains/available(批量 500/次)
 *    用随机不存在的标签探测每个后缀的注册价(响应含 price 微单位 + currency)。
 *    仅能取注册价; 续费/转入价 API 不提供, 置 null。
 *    凭证录入(/admin/credentials): type=api_key,
 *      values.token=<Key>, values.secret=<Secret>
 *    注意: 生产 Key 需账户满足条件(如 50+ 域名)才能用部分接口;
 *    availability 接口普通 Key 即可。若报 403 可先用 OTE Key 验证连通性。
 * 2. html: godaddy.com 价格页为重 JS + 区域化渲染, 不可用。
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const API_BASE = "https://api.godaddy.com"
/** 随机不存在的域名标签, 用于探测注册价 */
const PROBE_LABEL = "dhx7q0zk4v1probe"

interface GoDaddyAvailability {
  domain?: string
  available?: boolean
  price?: number
  currency?: string
}

export const godaddyAdapter = defineAdapter({
  slug: "godaddy",
  name: "GoDaddy",
  website: "https://www.godaddy.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
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
    supportedCurrencies: ["USD"],
    supportedLanguages: ["en"],
  },
  rateLimit: { concurrency: 1, rpm: 50, retries: 2, timeoutMs: 60_000 },
  hooks: {
    async initialize(ctx) {
      const cred = await ctx.getCredential("api_key")
      if (!cred?.values.token || !cred?.values.secret) {
        throw new Error(
          "GoDaddy 缺少 API 凭证。请在 /admin/credentials 为 godaddy 录入 type=api_key 凭证: token=<Key>, secret=<Secret>(免费: developer.godaddy.com)",
        )
      }
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
  ],
})
