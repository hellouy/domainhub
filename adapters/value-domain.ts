/**
 * Value Domain —— 日本注册商（JPY，多注册商聚合）
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.value-domain.com/domain/price/index.html (直连 200/341KB)
 * 表: ドメイン名 | 新規取得(初年度) | 更新/年 | 移管 | 新規取得(定価) | WHOIS代行
 * 特点:
 *  - 同 TLD 多个注册商行(eNom/GMO/KeySystems)，渠道名在单元格内 `（eNom）` 等。
 *  - 移管(转移)价多数行为 `-`(不提供)，仅部分行有值；跨渠道合并可得更多转移价。
 *  - 取 eNom 行为标准(首个渠道)，其余渠道仅用于补齐该行缺失的转移价。
 * 币种 JPY。
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.value-domain.com/domain/price/index.html"

function parsePriceCell(s: string | null | undefined): number | null {
  if (!s || s.trim() === "-") return null
  const m = s.replace(/[^0-9.]/g, "")
  const v = Number.parseFloat(m)
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null
}

export const valuedomainAdapter = defineAdapter({
  slug: "value-domain",
  name: "Value Domain",
  website: "https://www.value-domain.com",
  owner: "Data Team",
  version: "1.1.0",
  parserVersion: "1.1.0",
  currency: "JPY",
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    supportedCurrencies: ["JPY"],
  },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse(raw: string): Promise<RawPrice[]> {
        const out: RawPrice[] = []
        const collected = new Map<string, RawPrice>()
        const tableMatch = raw.match(/<table[^>]*>([\s\S]*?)<\/table>/i)
        if (!tableMatch) throw new Error("Value Domain 页面未找到表格")
        const rows = tableMatch[1].match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []
        for (const row of rows) {
          const cells = [...row.matchAll(/<(td|th)[^>]*>([\s\S]*?)<\/(td|th)>/gi)].map(m =>
            m[2].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/[\s]+/g, " ").trim(),
          )
          if (cells.length < 4) continue
          const first = cells[0].toLowerCase()
          if (first.includes("ドメイン") || first.includes("新規取得") || first.includes("domain")) continue
          const tldRaw = cells[0].replace(/（.*$/, "").replace(/^\./, "").toLowerCase().trim()
          if (!tldRaw || !/^[a-z0-9]/.test(tldRaw)) continue
          const reg = parsePriceCell(cells[1])
          const ren = parsePriceCell(cells[2])
          const tr = parsePriceCell(cells[3])
          if (reg == null && ren == null && tr == null) continue
          let price = collected.get(tldRaw)
          if (!price) {
            price = { tld: tldRaw, currency: "JPY", sourceUrl: URL }
            collected.set(tldRaw, price)
          }
          // 首个渠道(通常 eNom)为准，仅补齐缺失字段
          if (price.registerPrice == null && reg != null) price.registerPrice = reg
          if (price.renewPrice == null && ren != null) price.renewPrice = ren
          if (price.transferPrice == null && tr != null) price.transferPrice = tr
        }
        for (const price of collected.values()) out.push(price)
        if (out.length < 100) throw new Error(`Value Domain 解析行数异常: ${out.length}`)
        return Promise.resolve(out)
      },
    },
  ],
})