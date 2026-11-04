/**
 * Aruba —— 分组价目表 (EUR, 注册/续费)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.aruba.it/listino-domini.aspx
 * 页面含 30 个 <table>：前 15 个为注册价，后 15 个为续费价。
 * 每组 TLD 共享同一价格；表 0-1 和 15-16（it 系 / com-net-org）的 TLD 列表服务端渲染，
 * 其余 26 个 slot 表的 TLD 列表由页面 JS 从独立数据端点填充：
 *   https://managehosting.aruba.it/GetEstensioniFasce.asp
 * 该端点返回纯文本分组（组间 & 分隔、组内 | 分隔，共 13 组，注册/续费共用同一分组），
 * 服务端可直接 GET（无需浏览器、无跨域限制）。parse 时合并：
 * 表 2-14 / 17-29 的 TLD 取自该端点，分组价格取自有服务端渲染价格的表。
 * 全程无需 playwright；fasce 端点不可用时优雅回退到仅服务端渲染的 13 个 TLD。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.aruba.it/listino-domini.aspx"
/** TLD 分组端点：13 个价格带分组（& 分隔组、| 分隔 TLD），注册/续费 slot 表共用 */
const FASCE_URL = "https://managehosting.aruba.it/GetEstensioniFasce.asp"
/** slot 表分组数（表 2-14 注册、表 17-29 续费，各 13 组） */
const SLOT_GROUP_COUNT = 13

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

/** 拉取 TLD 分组；失败返回空数组（优雅回退到仅服务端渲染的 13 个 TLD） */
async function fetchSlotGroups(ctx: AdapterContext): Promise<string[][]> {
  try {
    const res = await ctx.fetch(FASCE_URL)
    if (!res.ok) return []
    const text = await res.text()
    return text
      .split("&")
      .map((g) => g.split("|").map((t) => t.trim().toLowerCase()).filter(Boolean))
      .filter((g) => g.length > 0)
      .slice(0, SLOT_GROUP_COUNT)
  } catch {
    return []
  }
}

async function parseAruba(raw: string, ctx: AdapterContext): Promise<RawPrice[]> {
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

  // slot 表（表 2-14 注册 / 17-29 续费）的 TLD 列表来自 fasce 数据端点；
  // playwright 渲染成功的 HTML 中 slot 已被同一数据填充，覆盖写入等价且去重
  const groups = await fetchSlotGroups(ctx)
  for (let i = 0; i < SLOT_GROUP_COUNT; i++) {
    const g = groups[i]
    if (!g || g.length === 0) continue
    if (regGroups[i + 2]) regGroups[i + 2].tlds = g
    if (renGroups[i + 2]) renGroups[i + 2].tlds = g
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
  version: "1.1.0",
  parserVersion: "1.1.0",
  owner: "Data Team",
  currency: "EUR",
  capabilities: { registration: true, renewal: true, transfer: false, supportedCurrencies: ["EUR"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 1, timeoutMs: 90_000 },
  strategies: [
    { type: "html", url: URL, parse: parseAruba },
    { type: "playwright", url: URL, parse: parseAruba, browser: { extract: "html", waitForTimeoutMs: 40_000 } },
  ],
})
