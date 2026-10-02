/**
 * MCHost —— 静态价目表(卢布, 注册/续费)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://mchost.ru/services/domains/
 * 表: table.dom_list, 列 域名 | 注册/续费
 * 价格单元: "119 ₽"(仅注册) 或 "119 ₽ / 169 ₽"(注册/续费), ₽ 用 span.ruble 字形。
 * 已验证约 684 TLD, RUB/年, 无转入价; 多数行仅注册价。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://mchost.ru/services/domains/"

async function parseMcHost(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const tables = raw.match(/<table[^>]*class="[^"]*dom_list[^"]*"[^>]*>[\s\S]*?<\/table>/gi) ?? []
  for (const tbl of tables) {
    const rows = tbl.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
    for (const tr of rows) {
      if (/<th[ >]/i.test(tr)) continue
      const cells = tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []
      if (cells.length < 2) continue
      // tld 单元格: 去掉 <a>, 去掉前导点; 可能含 IDN(如 .рф)
      let tld = (cells[0] ?? "").replace(/<[^>]+>/g, "").trim()
      tld = tld.toLowerCase().replace(/^\./, "")
      if (!tld || !/^[\p{L}0-9-]{2,}$/u.test(tld)) continue
      if (seen.has(tld)) continue
      // 价格单元格: 形如 "119 / 169" 或 "119"
      const cellText = cells[1].replace(/<[^>]+>/g, "").replace(/[^\d.,\s/]/g, "").trim()
      const parts = cellText.split("/").map((p) => p.trim()).filter(Boolean)
      const read = (p: string): number | null => {
        const n = Number.parseFloat(p.replace(/\s/g, "").replace(",", "."))
        return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
      }
      const reg = parts.length > 0 ? read(parts[0]) : null
      const ren = parts.length > 1 ? read(parts[1]) : null
      if (reg == null && ren == null) continue
      const price: RawPrice = { tld, currency: "RUB", sourceUrl: URL }
      if (reg != null) price.registerPrice = reg
      if (ren != null) price.renewPrice = ren
      seen.add(tld)
      out.push(price)
    }
  }
  if (out.length === 0) throw new Error("mchost 解析结果为空(页面结构可能已变化)")
  return out
}

export const mchostAdapter = defineAdapter({
  slug: "mchost",
  name: "MCHost",
  website: "https://mchost.ru",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "RUB",
  capabilities: { registration: true, renewal: true, supportedCurrencies: ["RUB"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse: parseMcHost,
    },
  ],
})