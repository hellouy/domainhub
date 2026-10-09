/**
 * Aruba —— 分组价目表 (EUR, 注册/续费)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.aruba.it/listino-domini.aspx
 * 页面含 30 个 <table>：前 15 个为注册价，后 15 个为续费价。
 * 每组 TLD 共享同一价格；TLD 列表在 JS 渲染的 slot 单元格中。
 * 表 0-1 和 15-16 的 TLD 列表服务端渲染，其余需 playwright。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.aruba.it/listino-domini.aspx"

function parsePrice(text: string): number | null {
  const m = text.match(/([\d.,]+)/)
  if (!m) return null
  const n = Number.parseFloat(m[1].replace(".", "").replace(",", "."))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

function extractTlds(text: string): string[] {
  const tlds = text.match(/\.([a-z0-9]{2,}(?:\.[a-z]{2})?)/g) ?? []
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of tlds) {
    const clean = t.replace(/^\./, "").toLowerCase()
    if (!seen.has(clean) && /^[\p{L}0-9-]{2,}$/u.test(clean)) {
      seen.add(clean)
      out.push(clean)
    }
  }
  return out
}

async function parseAruba(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const tables = raw.match(/<table[^>]*>[\s\S]*?<\/table>/gi) ?? []
  if (tables.length < 2) throw new Error("aruba 表格解析结果为空(页面结构可能已变化)")

  type GroupPrice = { price: number | null; tlds: string[] }
  const regGroups: GroupPrice[] = []
  const renGroups: GroupPrice[] = []

  for (let i = 0; i < tables.length; i++) {
    const tbl = tables[i]
    const priceText = tbl.replace(/<[^>]+>/g, " ").replace(/&euro;|&nbsp;/g, " ")
    const price = parsePrice(priceText)

    const bodyText = tbl.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ")
    const tlds = extractTlds(bodyText)

    const group: GroupPrice = { price, tlds }
    if (i < 15) regGroups.push(group)
    else renGroups.push(group)
  }

  const regMap = new Map<string, number | null>()
  for (const g of regGroups) {
    for (const tld of g.tlds) {
      if (!regMap.has(tld)) regMap.set(tld, g.price)
    }
  }

  const renMap = new Map<string, number | null>()
  for (const g of renGroups) {
    for (const tld of g.tlds) {
      if (!renMap.has(tld)) renMap.set(tld, g.price)
    }
  }

  const allTlds = new Set([...regMap.keys(), ...renMap.keys()])
  const out: RawPrice[] = []
  for (const tld of allTlds) {
    const reg = regMap.get(tld) ?? null
    const ren = renMap.get(tld) ?? null
    if (reg == null && ren == null) continue
    const price: RawPrice = { tld, currency: "EUR", sourceUrl: URL }
    if (reg != null) price.registerPrice = reg
    if (ren != null) price.renewPrice = ren
    out.push(price)
  }

  if (out.length === 0) throw new Error("aruba 解析结果为空(页面结构可能已变化)")
  return out
}

export const arubaAdapter = defineAdapter({
  slug: "aruba",
  name: "Aruba",
  website: "https://www.aruba.it",
  version: "1.0.0",
  parserVersion: "1.0.0",
  owner: "Data Team",
  currency: "EUR",
  capabilities: { registration: true, renewal: true, transfer: false, supportedCurrencies: ["EUR"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 1, timeoutMs: 90_000 },
  strategies: [
    { type: "playwright", url: URL, parse: parseAruba, browser: { extract: "html", waitForTimeoutMs: 40_000 } },
    { type: "html", url: URL, parse: parseAruba },
  ],
})
