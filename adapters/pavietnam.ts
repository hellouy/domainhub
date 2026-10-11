/**
 * P.A Vietnam —— 越南注册商价目(VND)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.pavietnam.vn/vn/ten-mien-bang-gia.html
 * 双表结构(越南国内 TLD 表 + 国际 gTLD 表), 统一 4 列:
 *   表头: Tên miền | Đăng ký | Gia hạn | Chuyển về P.A
 *   行:   .com Ưu đãi Giảm 404K | 429.000đ 25.000đ | 429.000đ | 322.000đ
 * 币种 VND(越南盾),VND 币种注册商库内为 0, 本源填补空白。
 * 覆盖 .vn 全家族(含 angiang.vn/bacninh.vn 等 33 个省级子域, tlds 表新增) +
 *   500+ 通用 gTLD/ccTLD。
 * 解析要点:
 *   - TLD 单元格为合并单元格, 含多个 TLD + 促销标签("Ưu đãi Giảm 250K"), 逐 tld 展开
 *   - 注册列为 "原价đ 促销价đ" 双值, 取 min(促销价) 与 namesilo 双价策略一致
 *   - 价格 "429.000đ" 点千分位, 去点转数字
 *   - 过滤非 .vn 的二级子域 TLD(jpn.com/nom.co/za.com/gb.net/off.ai 等二手市场变体)
 *   - 过滤天价特殊域名(1字符/2字符 .VN 注册价千万盾级)
 * 限流(2026-10-11): 直连页面 JS 渲染需 anti-bot 通道(949KB/560 行)拿完整价目表。
 */
import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.pavietnam.vn/vn/ten-mien-bang-gia.html"
const MAX_PRICE = 9_000_000

/** 解析越南盾价格 "429.000đ 25.000đ"/"150.000 đ" → 429000, 双值取 min(促销价) */
function parseVND(v: string): number | null {
  const t = v.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
  if (!t || t === "-" || t === "—") return null
  if (/Tiếp tục|Tặng|VAT|không|hỗ trợ/i.test(t)) return null
  const nums = t.match(/\d[\d.]*\.?\d*\s*đ/g)
  if (!nums) return null
  const parsed = nums
    .map((x) => parseFloat(x.replace(/\./g, "").replace(/đ/gi, "")))
    .filter((n) => Number.isFinite(n) && n > 0)
  if (!parsed.length) return null
  return Math.min(...parsed)
}

/** 从合并单元格提取 tld 列表, 已过滤非 .vn 二级子域与天价特殊域名 */
function extractTlds(cell: string): string[] {
  const raw = cell.toLowerCase()
  const out = new Set<string>()
  for (const m of raw.matchAll(/\.([\p{L}\p{N}-]+(?:\.vn)?)(?![.\w-])/gu)) {
    const t = m[1]
    if (t.endsWith(".vn")) out.add(t)
    else if (!t.includes(".")) out.add(t)
  }
  return [...out]
}

function parsePavietnam(raw: string): RawPrice[] {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const rows = raw.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    if (/<th[ >]/i.test(tr)) continue
    const cells = (tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []).map((c) =>
      c.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(),
    )
    if (cells.length < 3) continue
    const tlds = extractTlds(cells[0] ?? "")
    if (!tlds.length) continue
    const reg = parseVND(cells[1] ?? "")
    const ren = parseVND(cells[2] ?? "")
    if (reg == null || ren == null || reg > MAX_PRICE || ren > MAX_PRICE) continue
    const tra = parseVND(cells[3] ?? "")
    for (const tld of tlds) {
      if (seen.has(tld)) continue
      seen.add(tld)
      const price: RawPrice = { tld, currency: "VND", sourceUrl: URL }
      price.registerPrice = reg
      price.renewPrice = ren
      if (tra != null) price.transferPrice = tra
      out.push(price)
    }
  }
  if (out.length < 100) throw new Error(`pavietnam 解析行数异常: ${out.length}(页面结构可能已变化)`)
  return out
}

export const pavietnamAdapter = defineAdapter({
  slug: "pavietnam",
  name: "P.A Vietnam",
  website: "https://www.pavietnam.vn",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "VND",
  priority: 50,
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["VND"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 120_000 },
  strategies: [
    {
      type: "anti-bot",
      url: URL,
      antiBot: { keyword: "Đăng ký" },
      parse(raw: string): RawPrice[] {
        return parsePavietnam(raw)
      },
    },
  ],
})