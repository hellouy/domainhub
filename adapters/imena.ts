/**
 * Imena —— 静态价目表(注册价, UAH)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://imena.ua/domains/prices
 * 表: .border_table.full, 列 TLD | Registration min term | max term | Price for 1 year
 * 价目单元格含两个 div: zone-price-noaction(列表价) + magicprice_UAH(实付价, 取此)
 * 无续费/转入列。
 * 已验证约 347 TLD(UAH)。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://imena.ua/domains/prices"

async function imenaFetch(ctx: AdapterContext): Promise<string> {
  const res = await ctx.fetch(URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

async function parseImena(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const rows = raw.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    const cells = tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []
    if (cells.length < 4 || !cells[0] || !cells[3]) continue
    const tldCell = cells[0].replace(/<[^>]+>/g, "").replace(/&nbsp;|&amp;|&copy;/gi, " ").trim()
    const tld = tldCell.toLowerCase().replace(/^\./, "")
    if (!/^[a-z0-9\u00e0-\uffff-]{2,}$/.test(tld)) continue
    // 价格单元格中找 magicprice_UAH div
    const priceCell = cells[3]
    const m = priceCell.match(/<div class="magicprice_UAH"[^>]*>\s*([\d.,\s\u00a0]+?)\s*UAH\s*<\/div>/i)
    if (!m) continue
    const numText = m[1].replace(/[\s\u00a0]/g, "").replace(",", ".")
    const n = Number.parseFloat(numText)
    if (!Number.isFinite(n) || n <= 0) continue
    if (seen.has(tld)) continue
    seen.add(tld)
    out.push({ tld, currency: "UAH", registerPrice: Math.round(n * 100) / 100, sourceUrl: URL })
  }
  if (out.length === 0) throw new Error("imena 解析结果为空(页面结构可能已变化)")
  return out
}

export const imenaAdapter = defineAdapter({
  slug: "imena",
  name: "Imena",
  website: "https://imena.ua",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "UAH",
  capabilities: { registration: true, supportedCurrencies: ["UAH"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      fetch: imenaFetch,
      parse: parseImena,
    },
  ],
})