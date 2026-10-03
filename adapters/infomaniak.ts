/**
 * Infomaniak 适配器(Adapter SDK 2.0) — 官方 API 骨架
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源结论:
 * - api.infomaniak.com 需 OAuth/Bearer token(manager API), 且域名价格
 *   需账号开通 Domain 产品权限。无公开批量价格表。
 *
 * 等 Key 即用骨架: 后台配置 api_key(token=<API Token>)后自动接 api.infomaniak.com。
 * 注意: 由于价格读取依赖账号产品权限与具体 TLD 目录契约, 首采前需用真实
 *   token 核对下方价格端点的字段结构(见 parse 注释), 必要时微调字段名。
 *
 * 凭证录入(/admin/credentials): type=api_key, values.token=<API Token>
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const API_BASE = "https://api.infomaniak.com"

export const infomaniakAdapter = defineAdapter({
  slug: "infomaniak",
  name: "Infomaniak",
  website: "https://www.infomaniak.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "EUR",
  priority: 28,
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    api: true,
    supportedCurrencies: ["EUR", "CHF"],
    supportedLanguages: ["fr", "en"],
  },
  rateLimit: { concurrency: 1, rpm: 20, retries: 2, timeoutMs: 60_000 },
  strategies: [
    {
      type: "private-api",
      url: `${API_BASE}/1/domain`,
      async fetch(ctx) {
        const cred = await ctx.getCredential("api_key")
        const token = cred?.values.token
        if (!token) {
          throw new Error("Infomaniak 缺少 API Token。请在 /admin/credentials 为 infomaniak 录入 type=api_key")
        }
        const res = await ctx.fetch(`${API_BASE}/1/domain`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        })
        if (!res.ok) {
          throw new Error(`Infomaniak API HTTP ${res.status}(401 = Token 无效或缺少 Domain 产品权限; 400 = 缺 product slug)`)
        }
        return res.text()
      },
      parse(raw: string): RawPrice[] {
        // 契约待真实 token 核验: Infomaniak /1/domain 返回已购域名列表,
        // 价格目录不走批量公开端点。此处返回 demoparse 占位——
        // 见包顶部注释, 首采前用真实 token 据此端点补齐字段映射。
        let data: unknown
        try {
          data = JSON.parse(raw)
        } catch {
          data = null
        }
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error("Infomaniak /1/domain 未返回可解析的价格行(需真实 token + Domain 产品权限核验契约)")
        }
        const prices: RawPrice[] = []
        for (const row of data as Array<Record<string, unknown>>) {
          const tld = String(row.tld ?? row.domain_name ?? "").trim().toLowerCase().replace(/^\./, "")
          if (!tld) continue
          // 价格字段名待真实 token 校验; 默认取常见命名, 取不到则跳过
          const num = (v: unknown): number | null => {
            const n = typeof v === "number" ? v : v == null ? null : Number.parseFloat(String(v))
            return Number.isFinite(n as number) && (n as number) > 0 ? (n as number) : null
          }
          const reg = num(row.register ?? row.registration_price ?? row.price)
          const renew = num(row.renew ?? row.renewal_price)
          const transfer = num(row.transfer ?? row.transfer_price)
          if (reg == null && renew == null && transfer == null) continue
          prices.push({ tld, registerPrice: reg, renewPrice: renew, transferPrice: transfer, currency: "EUR", sourceUrl: `${API_BASE}/1/domain` })
        }
        if (prices.length === 0) {
          throw new Error("Infomaniak 未映射出价格字段: 需用真实 token 核对返回 JSON 的价格字段名并微调 parse")
        }
        return prices
      },
    },
  ],
})