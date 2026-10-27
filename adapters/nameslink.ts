/**
 * NamesLink (www.nameslink.com) —— 域名价格列表
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: POST https://www.nameslink.com/api/domain/registry/query-suffix-price
 * 请求: JSON { suffixList:[], categoryList:[], pageNum, pageSize }
 * 响应: { data:{ total, data:[{suffix, registerPrice, renewPrice, transferPrice, redeemPrice}] } }
 * 已验证: 200 TLD, USD/年, 无需登录。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const API_URL = "https://www.nameslink.com/api/domain/registry/query-suffix-price"
const PAGE_SIZE = 200
const SOURCE = "https://www.nameslink.com/zh/domain/pricing"

async function nameslinkFetch(ctx: AdapterContext): Promise<string> {
  const rows: any[] = []
  let page = 1
  for (;;) {
    const res = await ctx.fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
      body: JSON.stringify({ suffixList: [], categoryList: [], pageNum: page, pageSize: PAGE_SIZE }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const j = await res.json().catch(() => null)
    if (!j?.data || j.success === false) {
      throw new Error(`nameslink API 错误: ${j?.code ?? "unknown"} ${j?.message ?? ""}`)
    }
    const batch: any[] = j.data.data ?? []
    rows.push(...batch)
    if (batch.length < PAGE_SIZE || page >= (j.data.totalPages ?? 1)) break
    page++
  }
  if (rows.length === 0) throw new Error("nameslink 响应为空")
  return JSON.stringify(rows)
}

function toNum(s: unknown): number | null {
  const t = String(s ?? "").trim()
  if (!t) return null
  const n = Number.parseFloat(t)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

async function parseNameslink(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  let rows: any[]
  try {
    rows = JSON.parse(raw)
  } catch {
    throw new Error("nameslink 响应不是合法 JSON")
  }

  const out: RawPrice[] = []
  const seen = new Set<string>()

  for (const it of rows) {
    const tld = String(it?.suffix ?? "").replace(/^\./, "").toLowerCase()
    if (!tld || seen.has(tld) || !/^[a-z0-9-]{2,}$/.test(tld)) continue
    seen.add(tld)

    const reg = toNum(it?.registerPrice)
    const ren = toNum(it?.renewPrice)
    const trf = toNum(it?.transferPrice)
    if (reg == null && ren == null && trf == null) continue

    const price: RawPrice = { tld, currency: "USD", sourceUrl: SOURCE }
    if (reg != null) price.registerPrice = reg
    if (ren != null) price.renewPrice = ren
    if (trf != null) price.transferPrice = trf
    out.push(price)
  }

  if (out.length === 0) throw new Error("nameslink 解析结果为空")
  return out
}

export const nameslinkAdapter = defineAdapter({
  slug: "nameslink",
  name: "NamesLink",
  website: "https://www.nameslink.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    supportedCurrencies: ["USD"],
    supportedLanguages: ["en", "zh"],
  },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "api",
      url: API_URL,
      fetch: nameslinkFetch,
      parse: parseNameslink,
    },
  ],
})