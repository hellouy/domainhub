/**
 * GName —— 公开价目 POST API(分页)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: POST https://www.gname.com/request/get_price
 * 表单: page, limit, (sou/lx/tj/hy/fz 可选)
 * 响应: {code:1, data:{ymjg:[{hz, zcjg(注册), zrjg(转入), xfjg(续费)}]}}
 * 已验证约 86 TLD/页, USD/年。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const PAGE_SIZE = 200

async function gnameFetch(ctx: AdapterContext): Promise<string> {
  const rows: any[] = []
  let page = 1
  for (;;) {
    const form = new URLSearchParams()
    form.set("page", String(page))
    form.set("limit", String(PAGE_SIZE))
    const res = await ctx.fetch("https://www.gname.com/request/get_price", {
      method: "POST",
      headers: { "X-Requested-With": "XMLHttpRequest", "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const j = await res.json().catch(() => null)
    const batch: any[] = j?.data?.ymjg ?? []
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
    page++
  }
  if (rows.length === 0) throw new Error("gname 响应为空")
  return JSON.stringify(rows)
}

async function parseGname(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  let rows: any[]
  try {
    rows = JSON.parse(raw)
  } catch {
    throw new Error("gname 响应不是合法 JSON")
  }
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const toNum = (s: unknown): number | null => {
    const t = String(s ?? "").trim()
    if (!t) return null
    const n = Number.parseFloat(t)
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
  }
  for (const it of rows) {
    const tld = String(it?.hz ?? "").replace(/^\./, "").toLowerCase()
    if (!tld || seen.has(tld)) continue
    const price: RawPrice = { tld, currency: "USD", sourceUrl: "https://www.gname.com/price" }
    const reg = toNum(it?.zcjg)
    const tra = toNum(it?.zrjg)
    const ren = toNum(it?.xfjg)
    if (reg != null) price.registerPrice = reg
    if (tra != null) price.transferPrice = tra
    if (ren != null) price.renewPrice = ren
    seen.add(tld)
    out.push(price)
  }
  if (out.length === 0) throw new Error("gname 解析结果为空")
  return out
}

export const gnameAdapter = defineAdapter({
  slug: "gname",
  name: "GName",
  website: "https://www.gname.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["USD"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "api",
      url: "https://www.gname.com/request/get_price",
      fetch: gnameFetch,
      parse: parseGname,
    },
  ],
})