/**
 * OnlyDomains —— 静态价目表(USD, 单元格数值实体)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.onlydomains.com/domains/pricing
 * 表列: TLD | Country/Type | Min. Term | Price | Renewal | Transfer | Restore*
 * 价格形如 "&#36;13.49"(数值实体), 需解码后解析。
 * 币种: 页面默认 geolocate 不稳定, 需 POST currency=USD(带 csrf+cookie 会话) 锁定 USD。
 * 转移列大量为 $0.00(免费转入), 2026-10-11 改为允许 0 值采入。
 * 已验证数百 TLD, USD/年。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.onlydomains.com/domains/pricing"

async function parseOnlyDomains(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  // 解码数值 HTML 实体(&#36;=$)
  const html = raw.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    const cells = tr.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? []
    if (cells.length < 4) continue
    // TLD 取自首列 anchor：<a href="/domains/...">.ac.nz</a>
    const c0 = cells[0] ?? ""
    const tldM = c0.match(/<a[^>]*href="[^"]*"[^>]*>\s*\.?([a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*)\s*<\/a>/i)
    if (!tldM) continue
    const tld = tldM[1].toLowerCase()
    if (!tld || seen.has(tld)) continue
    const readCell = (c: string): number | null => {
      // 取单元格内 "$X.XX" 形式的价格（忽略整数 aria 副本）
      const m = c.match(/\$(\d{1,3}(?:[.,]\d{1,3})+(?:[.,]\d{1,2})?)/)
      if (!m) return null
      const txt = m[1].replace(/,/g, "")
      const n = Number.parseFloat(txt)
      if (!Number.isFinite(n) || n <= 0) return null
      return Math.round(n * 100) / 100
    }
    const readCellAllowZero = (c: string): number | null => {
      // 转移列允许 $0.00（免费转入）
      const m = c.match(/\$(\d{1,3}(?:[.,]\d{1,3})+(?:[.,]\d{1,2})?)/)
      if (!m) return null
      const txt = m[1].replace(/,/g, "")
      const n = Number.parseFloat(txt)
      if (!Number.isFinite(n) || n < 0) return null
      return Math.round(n * 100) / 100
    }
    // 列: TLD|Country|Min Term|Price|Renewal|Transfer|Restore（用带 $ 前缀的真实价）
    const reg = readCell(cells[3] ?? "")
    const ren = readCell(cells[4] ?? "")
    const tra = readCellAllowZero(cells[5] ?? "")
    if (reg == null && ren == null && tra == null) continue
    const price: RawPrice = { tld, currency: "USD", sourceUrl: URL }
    if (reg != null) price.registerPrice = reg
    if (ren != null) price.renewPrice = ren
    if (tra != null) price.transferPrice = tra
    seen.add(tld)
    out.push(price)
  }
  if (out.length === 0) throw new Error("onlydomains 解析结果为空(页面结构可能已变化)")
  return out
}

export const onlydomainsAdapter = defineAdapter({
  slug: "onlydomains",
  name: "OnlyDomains",
  website: "https://www.onlydomains.com",
  owner: "Data Team",
  version: "1.2.0",
  parserVersion: "1.1.0",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: true, restore: true, supportedCurrencies: ["USD"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      async fetch(ctx: AdapterContext): Promise<string> {
        // onlydomains 币种随 geolocate 波动(曾误采为 AUD)，需 POST currency=USD 锁定会话
        const jar = new Map<string, string>()
        const setCookies = (setC: string | null) => {
          if (!setC) return
          for (const part of setC.split(",")) {
            const [kv] = part.split(";")
            const eq = kv.indexOf("=")
            if (eq > 0) jar.set(kv.slice(0, eq).trim(), kv.slice(eq + 1).trim())
          }
        }
        const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ")
        const headers = (extra: Record<string, string> = {}) => ({
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0",
          Cookie: cookieHeader(),
          ...extra,
        })
        const r1 = await ctx.fetch(URL, { headers: headers() })
        if (!r1.ok) throw new Error(`onlydomains 价格页返回 HTTP ${r1.status}`)
        setCookies(r1.headers.get("set-cookie"))
        const h1 = await r1.text()
        const csrf = h1.match(/name="csrfToken" value="([^"]+)"/)
        if (csrf) {
          const r2 = await ctx.fetch(URL, {
            method: "POST",
            headers: headers({ "Content-Type": "application/x-www-form-urlencoded" }),
            body: `csrfToken=${encodeURIComponent(csrf[1])}&currency=USD`,
            redirect: "manual",
          })
          setCookies(r2.headers.get("set-cookie"))
          const r3 = await ctx.fetch(URL, { headers: headers() })
          if (r3.ok) {
            setCookies(r3.headers.get("set-cookie"))
            return await r3.text()
          }
        }
        return h1
      },
      parse(raw, ctx) {
        return parseOnlyDomains(raw, ctx)
      },
    },
  ],
})