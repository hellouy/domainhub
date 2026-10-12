/**
 * MilesWeb —— 印度注册商价目(INR)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.milesweb.in/domains/price
 * 表头: Domain extension | First year | Renews at | Transfer | Action
 * 行:   .in | ₹1 .IN Registration Offer ... | ₹899 | ₹549 | Register
 * 币种 INR(印度卢比),INR 币种注册商库内为 0, 本源填补空白。
 * 覆盖 .in 全家族(co.in/net.in/org.in/firm.in 等) + 通用 gTLD, 三价齐全。
 * 解析要点:
 *   - First year 单元格含促销说明文本(".in ₹1 首年, 2/3 年 ₹849"), 取首个 ₹N 数值为注册价
 *   - 促销首年价(₹1)低于真实年费, 用 register<renew/3 全局 guard 处理
 *   - 价格格式 "₹1,599" 逗号千分位
 * 限流(2026-10-11): 直连 153KB/119 行可拿完整价目表。
 */
import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.milesweb.in/domains/price"

/** 解析印度格式价格 "₹1,599" / "₹399 .COM Registration Offer ..." → 1599 */
function parseINR(v: string): number | null {
  const t = v.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
  if (!t || t === "-" || t === "—") return null
  const m = t.match(/₹\s?([\d,]+(?:\.\d{1,2})?)/)
  if (!m) return null
  const n = parseFloat(m[1].replace(/,/g, ""))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

function parseMilesWeb(raw: string): RawPrice[] {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const rows = raw.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    if (/<th[ >]/i.test(tr)) continue
    const tldAttr = tr.match(/data-tld=["']([^"']+)["']/i)
    const cells = (tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []).map((c) =>
      c.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(),
    )
    if (cells.length < 4) continue
    const tldRaw = (tldAttr?.[1] ?? cells[0] ?? "").trim().toLowerCase().replace(/\s+/g, "")
    const m = tldRaw.match(/^\.?([a-z0-9-]{2,20}(?:\.[a-z0-9-]{2,15}){0,2})$/)
    if (!m) continue
    const tld = m[1]
    if (!/^[a-z0-9][a-z0-9.-]*$/.test(tld) || seen.has(tld)) continue
    const reg = parseINR(cells[1] ?? "")
    const ren = parseINR(cells[2] ?? "")
    const tra = parseINR(cells[3] ?? "")
    if (reg == null && ren == null && tra == null) continue
    const price: RawPrice = { tld, currency: "INR", sourceUrl: URL }
    if (reg != null) price.registerPrice = reg
    if (ren != null) price.renewPrice = ren
    if (tra != null) price.transferPrice = tra
    seen.add(tld)
    out.push(price)
  }
  if (out.length < 50) throw new Error(`milesweb 解析行数异常: ${out.length}(页面结构可能已变化)`)
  return out
}

export const mileswebAdapter = defineAdapter({
  slug: "milesweb",
  name: "MilesWeb",
  website: "https://www.milesweb.in",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "INR",
  priority: 50,
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["INR"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 120_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse(raw: string): RawPrice[] {
        return parseMilesWeb(raw)
      },
    },
  ],
})