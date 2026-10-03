/**
 * Enom 适配器(Adapter SDK 2.0) — 官方 Reseller API 骨架
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源(等 Key 即用):
 * - Enom Reseller API(http://reseller.enom.com/interface.asp, GetDomainPricing)
 *   GetDomainPricing 一次性返回全部 TLD 的注册/续费/转入价(XML)。
 *   认证: 代理商 UID + PW(basic 凭证)。
 *   测试环境: https://resellertest.enom.com/interface.asp(免费测试账号可先用它验证)
 *   生产环境: https://reseller.enom.com/interface.asp
 *
 * 凭证录入(/admin/credentials): type=basic,
 *   username=<Enom UID>, password=<Enom PW>
 *
 * 说明: ETP/全托管账号需 ETP API Endpoint + ROID, 此时换用
 *   https://provinciadev.enom.com? 不适用; 本骨架默认标准 Reseller API。
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const RESELLER_API = "https://reseller.enom.com/interface.asp"
const RESELLER_API_TEST = "https://resellertest.enom.com/interface.asp"

export const enomAdapter = defineAdapter({
  slug: "enom",
  name: "Enom",
  website: "https://www.enom.com",
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
      url: `${RESELLER_API}?command=GetDomainPricing&responseformat=XML`,
      async fetch(ctx) {
        const cred = await ctx.getCredential("basic")
        const uid = cred?.values.username
        const pw = cred?.values.password
        if (!uid || !pw) {
          throw new Error("Enom 缺少代理商凭证。请在 /admin/credentials 为 enom 录入 type=basic 凭证(username=UID, password=PW)")
        }
        const params = new URLSearchParams({
          command: "GetDomainPricing",
          uid,
          pw,
          responseformat: "XML",
        })
        const res = await ctx.fetch(`${RESELLER_API}?${params.toString()}`, {
          headers: { Accept: "application/xml,text/xml,text/plain" },
        })
        if (!res.ok) {
          throw new Error(`Enom API HTTP ${res.status}(401 = 凭证无效；验证可用 resellertest.enom.com)`)
        }
        return res.text()
      },
      parse(raw: string): RawPrice[] {
        // GetDomainPricing XML: <interface-response><GetDomainPricing>
        //   <RRPEntry><tld>.com</tld><registerprice>12.99</registerprice>
        //   <renewprice>12.99</renewprice><transferprice>12.99</transferprice></RRPEntry>...
        const prices: RawPrice[] = []
        const entryRe = /<RRPEntry[^>]*>([\s\S]*?)<\/RRPEntry>/gi
        const val = (body: string, tag: string): number | null => {
          const m = body.match(new RegExp(`<${tag}>\\s*([\\d.]+)\\s*<\\/${tag}>`, "i"))
          if (!m) return null
          const n = Number.parseFloat(m[1])
          return Number.isFinite(n) && n > 0 ? n : null
        }
        for (const m of (raw.match(entryRe) ?? [])) {
          const tldM = m.match(/<tld>\s*\.?([a-z0-9.-]+)\s*<\/tld>/i)
          if (!tldM) continue
          const tld = tldM[1].toLowerCase()
          const reg = val(m, "registerprice") ?? val(m, "register")
          const renew = val(m, "renewprice") ?? val(m, "renew")
          const transfer = val(m, "transferprice") ?? val(m, "transfer")
          if (reg == null && renew == null && transfer == null) continue
          prices.push({ tld, registerPrice: reg, renewPrice: renew, transferPrice: transfer, currency: "USD", sourceUrl: RESELLER_API })
        }
        if (prices.length === 0) throw new Error("Enom API 未解析出任何 RRPEntry 价格(需用真实测试账号验证字段名)")
        return prices
      },
    },
  ],
})