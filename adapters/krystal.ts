/**
 * Krystal Hosting 适配器（英国 .uk 注册商，GBP）
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源: 定价页 https://krystal.uk/domains 服务端渲染 TLD 价格表。
 * 表头: Extension | Registration | Annual Renewal | Privacy and security | Action
 * 行:   .com | £11.99 | £11.99 | Free WHOIS | Search
 * 注册/续费双价, 无转入价(页面不提供)。
 * 策略链: html 直连(静态 SSR 表) → anti-bot 降级(直连被拦时走聚合反爬通道)。
 */
import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://krystal.uk/domains"

function parseKrystal(raw: string): RawPrice[] {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const rows = raw.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    if (/<th[ >]/i.test(tr)) continue
    const cells = (tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []).map((c) =>
      c.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(),
    )
    if (cells.length < 3) continue
    const m = (cells[0] ?? "").toLowerCase().match(/^\.?([a-z0-9-]+(?:\.[a-z0-9-]+)?)\b/)
    if (!m) continue
    const num = (s: string): number | null => {
      const mm = s.match(/[£$]?([\d.]+)/)
      if (!mm) return null
      const v = parseFloat(mm[1])
      return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null
    }
    const tld = m[1]
    if (seen.has(tld)) continue
    const reg = num(cells[1] ?? "")
    if (reg == null) continue
    const price: RawPrice = { tld, currency: "GBP", sourceUrl: URL }
    price.registerPrice = reg
    const ren = num(cells[2] ?? "")
    if (ren != null) price.renewPrice = ren
    seen.add(tld)
    out.push(price)
  }
  if (out.length < 10) throw new Error(`krystal 解析行数异常: ${out.length}(页面结构可能已变化)`)
  return out
}

export const krystalAdapter = defineAdapter({
  slug: "krystal",
  name: "Krystal",
  website: "https://krystal.uk",
  owner: "Data Team",
  version: "1.1.0",
  parserVersion: "1.1.0",
  currency: "GBP",
  priority: 50,
  capabilities: {
    registration: true,
    renewal: true,
    transfer: false,
    supportedCurrencies: ["GBP"],
  },
  rateLimit: { concurrency: 1, rpm: 8, retries: 2, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse(raw: string): RawPrice[] {
        return parseKrystal(raw)
      },
    },
    {
      type: "anti-bot",
      url: URL,
      antiBot: { keyword: "Extension" },
      parse(raw: string): RawPrice[] {
        return parseKrystal(raw)
      },
    },
  ],
})