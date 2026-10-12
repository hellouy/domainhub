/**
 * Easyspace —— 静态价目表(GBP)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.easyspace.com/pricelist
 * 页面含两个域名价格表:
 *   1. "Domain Name Extensions" 主表(5列): Extension | Term | Notification | Price | *Renewal
 *      term/notification 跳过, Price=注册价, *Renewal=续费价。约 539 TLD。
 *   2. "Domain Transfer In Costs" 转移表(3列): Extension | Term | Price
 *      Price=转入价。约 88 TLD(部分 .uk 系为 £0 免费转入)。
 * 两表按 TLD 合并: 主表提供 register/renew, 转移表提供 transfer。
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"
import { parsePrice } from "./shared/table-adapter"

const URL = "https://www.easyspace.com/pricelist"

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
}

function extractCells(tr: string): string[] {
  return [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => stripTags(m[1]))
}

export const easyspaceAdapter = defineAdapter({
  slug: "easyspace",
  name: "Easyspace",
  website: "https://www.easyspace.com",
  owner: "Data Team",
  version: "1.1.0",
  parserVersion: "1.1.0",
  currency: "GBP",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["GBP"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse(raw: string): RawPrice[] {
        const trs = raw.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
        const byTld = new Map<string, RawPrice>()

        const transferStart = raw.indexOf("Domain Transfer In Costs")
        const transferEnd = transferStart >= 0 ? raw.indexOf("</table>", transferStart) : -1

        for (const tr of trs) {
          const cells = extractCells(tr)
          if (cells.length < 2) continue
          const tldCell = cells[0]
          const tld = tldCell.toLowerCase().replace(/^\./, "").trim()
          if (!/^[a-z0-9][a-z0-9.-]*$/.test(tld)) continue

          if (cells.length >= 5) {
            const reg = parsePrice(cells[3])
            const ren = parsePrice(cells[4])
            if (reg == null && ren == null) continue
            const p: RawPrice = byTld.get(tld) ?? { tld, currency: "GBP", sourceUrl: URL }
            if (reg != null) p.registerPrice = reg
            if (ren != null) p.renewPrice = ren
            byTld.set(tld, p)
          }
        }

        if (transferStart >= 0 && transferEnd > transferStart) {
          const transferSeg = raw.slice(transferStart, transferEnd)
          const transferTrs = transferSeg.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
          for (const tr of transferTrs) {
            const cells = extractCells(tr)
            if (cells.length < 3) continue
            const tld = cells[0].toLowerCase().replace(/^\./, "").trim()
            if (!/^[a-z0-9][a-z0-9.-]*$/.test(tld)) continue
            const trText = cells[2]
            const trPrice = parsePrice(trText)
            if (trPrice == null && !/0/.test(trText.replace(/[^0-9]/g, ""))) continue
            const p = byTld.get(tld)
            if (p) p.transferPrice = trPrice ?? 0
          }
        }

        const out = [...byTld.values()].filter((p) => p.registerPrice != null || p.renewPrice != null)
        if (out.length < 100) throw new Error(`Easyspace 解析行数异常: ${out.length}(页面结构可能已变化)`)
        return out
      },
    },
  ],
})
