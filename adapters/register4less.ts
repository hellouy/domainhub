/**
 * Register4Less —— 静态全价目表（TLD | Description | Yearly Price USD）
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://register4less.com/info/pricing
 * 结构: <tr><td width=1>sep</td>
 *         <td>ACADEMY</td><td width=1>sep</td>
 *         <td>Identity Digital gTLD...</td><td width=1>sep</td>
 *         <td align=right>&dollar;50.95</td><td width=1>sep</td></tr>
 * TLD 单元格为大写(部分含二级,如 AB.CA/YU.CA → 归一为 ca)，仅一列注册价(USD/年)。
 * 表驱动工厂无法处理"TLD 不在首列 + 描述列"布局, 这里自定义解析。
 * 已验证 433 行, 纯静态无 JS 挑战。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://register4less.com/info/pricing"

function parseRegister4Less(raw: string, _ctx: AdapterContext): RawPrice[] {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const rows = raw.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    const cells = tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []
    const texts = cells.map((c) =>
      c
        .replace(/<[^>]+>/g, " ")
        .replace(/&dollar;/g, "$")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim(),
    )
    const nonEmpty = texts.filter(Boolean)
    if (nonEmpty.length < 3) continue
    // 头行含 TLD|Description|Yearly Price
    if (/Domain Extension|Yearly Price/i.test(nonEmpty.join(" "))) continue
    const tldRaw = nonEmpty[0]
    const priceRaw = nonEmpty[nonEmpty.length - 1]
    // TLD 形如 ACADEMY / AB.CA(含非字母字符的统一只看首段字母)
    const m = tldRaw.match(/^([A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?)$/)
    if (!m) continue
    let tld = m[1].toLowerCase()
    // 加拿大地区二级(AB.CA/YU.CA等) → 归为 .ca
    if (/^[a-z]{2}\.ca$/.test(tld)) tld = "ca"
    if (seen.has(tld)) continue
    const price = Number.parseFloat(priceRaw.replace(/[^\d.]/g, ""))
    if (!Number.isFinite(price) || price <= 0 || price >= 100_000) continue
    seen.add(tld)
    out.push({ tld, currency: "USD", registerPrice: Math.round(price * 100) / 100, sourceUrl: URL })
  }
  if (out.length === 0) throw new Error("register4less 解析结果为空(页面结构可能已变化)")
  return out
}

export const register4lessAdapter = defineAdapter({
  slug: "register4less",
  name: "Register4Less",
  website: "https://www.register4less.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  capabilities: {
    registration: true,
    renewal: false,
    transfer: false,
    supportedCurrencies: ["USD"],
  },
  rateLimit: { concurrency: 1, rpm: 8, retries: 2, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      async fetch(ctx) {
        const res = await ctx.fetch(URL, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml",
          },
        })
        if (!res.ok) throw new Error(`register4less 价格页返回 HTTP ${res.status}`)
        return await res.text()
      },
      parse(raw, ctx) {
        return parseRegister4Less(raw, ctx)
      },
    },
  ],
})