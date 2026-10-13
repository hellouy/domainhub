/**
 * GoDaddy 折扣域名俱乐部(DDC)价格 — se.godaddy.com 会员价(SEK)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://se.godaddy.com/domains/discount-domain-club
 * 直连被 Akamai TLS 拦截 → anti-bot 策略走聚合服务(CRAWL_SERVICE_URL)渲染。
 *
 * 页面按钮 "See All 558 Extensions" 展开全部后缀。完整数据在 __NEXT_DATA__
 * (Gasket structured data) 的 domains 数组: 每项含 pricesByType
 * (registration/renewal/transfer) × 各价格列(listPrice/basicPrice/proPrice/premiumPrice)。
 * 取「普通价格列」listPrice(GoDaddys ordinarie pris)作 register/renew/transfer。
 * raw 为微单位(1 SEK = 1,000,000), 格式化 "119,00 kr"(逗号小数)。
 * 回退: 渲染表格仅含 18 个可见后缀, 取 DDC Baspris 列作 register/renew。
 */
import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"
import { extractTableRows, parseDualPrice, findTldCell } from "./shared/table-adapter"

const URL = "https://se.godaddy.com/domains/discount-domain-club"
const MICRO = 1_000_000

interface GdDdcPrice {
  raw?: number
  formatted?: string
}
interface GdDdcRow {
  tld?: string
  listPrice?: GdDdcPrice
  basicPrice?: GdDdcPrice
  proPrice?: GdDdcPrice
  premiumPrice?: GdDdcPrice
  pricesByType?: Record<
    "registration" | "renewal" | "transfer",
    { listPrice?: GdDdcPrice; basicPrice?: GdDdcPrice }
  >
}

/** 从 __NEXT_DATA__ 提取全部后缀, 普通价格列 listPrice */
function parseNextDataDomains(raw: string): RawPrice[] {
  const m = raw.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
  if (!m) return []
  let data: unknown
  try {
    data = JSON.parse(m[1])
  } catch {
    return []
  }
  const str = JSON.stringify(data)
  const idx = str.search(/"domains"\s*:\s*\[\{"tld"/)
  if (idx < 0) return []
  // 从 domains 数组起点做括号配对, 截取数组 JSON
  let i = str.indexOf("[", idx)
  let depth = 0
  let inStr = false
  let esc = false
  let end = -1
  while (i < str.length) {
    const ch = str[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === "\\") esc = true
      else if (ch === '"') inStr = false
    } else {
      if (ch === '"') inStr = true
      else if (ch === "[") depth += 1
      else if (ch === "]") {
        depth -= 1
        if (depth === 0) {
          end = i + 1
          break
        }
      }
    }
    i++
  }
  if (end < 0) return []
  let rows: GdDdcRow[]
  try {
    rows = JSON.parse(str.slice(idx + str.slice(idx).indexOf("[", 9), end)) as GdDdcRow[]
  } catch {
    return []
  }
  const prices: RawPrice[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const tld = String(row.tld ?? "").trim().toLowerCase().replace(/^\./, "")
    if (!tld || seen.has(tld)) continue
    const pt = row.pricesByType
    if (!pt) continue
    const toPrice = (v: GdDdcPrice | undefined): number | null => {
      if (!v || typeof v.raw !== "number" || v.raw <= 0) return null
      return Math.round((v.raw / MICRO) * 100) / 100
    }
    const reg = toPrice(pt.registration?.listPrice)
    const renew = toPrice(pt.renewal?.listPrice)
    const transfer = toPrice(pt.transfer?.listPrice)
    if (reg == null && renew == null && transfer == null) continue
    seen.add(tld)
    const p: RawPrice = { tld, currency: "SEK", sourceUrl: URL }
    if (reg != null) p.registerPrice = reg
    if (renew != null) p.renewPrice = renew
    if (transfer != null) p.transferPrice = transfer
    prices.push(p)
  }
  return prices
}

/** 回退: 渲染表格(仅可见后缀), 取 DDC Baspris 列 */
function parseRenderedTable(raw: string): RawPrice[] {
  const rows = extractTableRows(raw)
  const prices: RawPrice[] = []
  const seen = new Set<string>()
  for (const cells of rows) {
    const hit = findTldCell(cells)
    if (!hit) continue
    const [tld, idx] = hit
    if (seen.has(tld)) continue
    const basicCell = cells[idx + 2]
    if (!basicCell) continue
    const [reg, renew] = parseDualPrice(basicCell, "eu")
    if (reg == null) continue
    seen.add(tld)
    const p: RawPrice = { tld, currency: "SEK", sourceUrl: URL }
    if (reg != null) p.registerPrice = reg
    if (renew != null) p.renewPrice = renew
    prices.push(p)
  }
  return prices
}

export const godaddyDdcAdapter = defineAdapter({
  slug: "godaddy-ddc",
  name: "GoDaddy Discount Domain Club",
  website: URL,
  owner: "Data Team",
  version: "1.1.0",
  parserVersion: "1.1.0",
  currency: "SEK",
  priority: 45,
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    supportedCurrencies: ["SEK"],
    supportedLanguages: ["sv"],
  },
  rateLimit: { concurrency: 1, rpm: 6, retries: 2, timeoutMs: 120_000 },
  strategies: [
    {
      type: "anti-bot",
      url: URL,
      antiBot: { keyword: "Förnyas för" },
      async parse(raw: string): Promise<RawPrice[]> {
        const full = parseNextDataDomains(raw)
        if (full.length > 0) return full
        const fallback = parseRenderedTable(raw)
        if (fallback.length > 0) return fallback
        throw new Error("GoDaddy DDC 未解析出任何价格")
      },
    },
  ],
})
