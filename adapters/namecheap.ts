/**
 * Namecheap 适配器(Adapter SDK 2.0)— 官方 API,等 Key 即用
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源结论(2026-07):
 * 1. private-api: 官方 users.getPricing 接口(XML), 一次返回全量域名定价。
 *    要求: Namecheap 账户开通 API(免费, 需满足最低余额/订单条件之一)
 *    并将服务器出口 IP 加入白名单。
 *    凭证录入(/admin/credentials): type=api_key,
 *      values.token=<ApiKey>, values.username=<ApiUser>, values.clientIp=<白名单 IP>
 * 2. html: namecheap.com 价格页为 JS 渲染 + 反爬, 不可用。
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const API_BASE = "https://api.namecheap.com/xml.response"

/** 从 getPricing XML 中解析某一类目(REGISTER/RENEW/TRANSFER)的 1 年期价格 */
function parseCategory(xml: string, categoryName: string): Map<string, number> {
  const map = new Map<string, number>()
  // 定位 <ProductCategory Name="register"> ... </ProductCategory>(大小写不敏感)
  const catRe = new RegExp(
    `<ProductCategory[^>]*Name="${categoryName}"[^>]*>([\\s\\S]*?)</ProductCategory>`,
    "i",
  )
  const catMatch = catRe.exec(xml)
  if (!catMatch) return map
  const section = catMatch[1]
  // 每个 <Product Name="com"> 内取 Duration="1" 的 <Price Price="...">
  const prodRe = /<Product[^>]*Name="([^"]+)"[^>]*>([\s\S]*?)<\/Product>/gi
  let m: RegExpExecArray | null
  while ((m = prodRe.exec(section)) !== null) {
    const tld = m[1].toLowerCase().replace(/^\./, "")
    const body = m[2]
    const priceRe = /<Price[^>]*Duration="1"[^>]*?\bPrice="([\d.]+)"[^>]*\/>/i
    const pm = priceRe.exec(body)
    if (pm) {
      const v = Number.parseFloat(pm[1])
      if (Number.isFinite(v) && v > 0) map.set(tld, v)
    }
  }
  return map
}

export const namecheapAdapter = defineAdapter({
  slug: "namecheap",
  name: "Namecheap",
  website: "https://www.namecheap.com",
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
  rateLimit: { concurrency: 1, rpm: 6, retries: 2, timeoutMs: 120_000 },
  hooks: {
    async initialize(ctx) {
      const cred = await ctx.getCredential("api_key")
      if (!cred?.values.token || !cred?.values.username || !cred?.values.clientIp) {
        throw new Error(
          "Namecheap 缺少 API 凭证。请在 /admin/credentials 为 namecheap 录入 type=api_key 凭证: token=<ApiKey>, username=<ApiUser>, clientIp=<已加白名单的服务器出口 IP>",
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
        const params = new URLSearchParams({
          ApiUser: cred?.values.username ?? "",
          ApiKey: cred?.values.token ?? "",
          UserName: cred?.values.username ?? "",
          ClientIp: cred?.values.clientIp ?? "",
          Command: "namecheap.users.getPricing",
          ProductType: "DOMAIN",
        })
        const res = await ctx.fetch(`${API_BASE}?${params.toString()}`, {
          headers: { Accept: "application/xml" },
        })
        if (!res.ok) throw new Error(`Namecheap API 返回 HTTP ${res.status}`)
        const xml = await res.text()
        // API 级错误以 Status="ERROR" 返回
        if (/Status="ERROR"/i.test(xml)) {
          const errMatch = /<Error[^>]*>([\s\S]*?)<\/Error>/i.exec(xml)
          throw new Error(`Namecheap API 错误: ${errMatch?.[1]?.trim() ?? "未知(检查 IP 白名单与 Key)"}`)
        }
        return xml
      },
      async parse(raw): Promise<RawPrice[]> {
        const register = parseCategory(raw, "register")
        const renew = parseCategory(raw, "renew")
        const transfer = parseCategory(raw, "transfer")
        const allTlds = new Set([...register.keys(), ...renew.keys(), ...transfer.keys()])
        if (allTlds.size === 0) throw new Error("Namecheap getPricing 未解析出任何 TLD(响应结构可能变化)")
        const prices: RawPrice[] = []
        for (const tld of allTlds) {
          prices.push({
            tld,
            registerPrice: register.get(tld) ?? null,
            renewPrice: renew.get(tld) ?? null,
            transferPrice: transfer.get(tld) ?? null,
            currency: "USD",
            sourceUrl: "https://www.namecheap.com/support/api/methods/users/get-pricing/",
          })
        }
        return prices
      },
    },
  ],
})
