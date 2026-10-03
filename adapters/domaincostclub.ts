/**
 * DomainCostClub —— 静态会员价目表(members panel)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.domaincostclub.com/pricing.dhtml
 * 结构: 多个 .col-md-4 表; 只解析可见的 members panel
 *       (div.panel_type_members). 每行 <td>Extension</td><td>$REG</td><td>$REN</td>
 * 列: Extension | Registration | Renewals (无 transfer)
 * 已验证约 460 TLD, USD/年。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.domaincostclub.com/pricing.dhtml"

async function parseDcc(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  // 定位 members panel(可见), 在面板内抓取全部 <tr>
  const panelMatches = raw.match(/<div class="row panel_type_members[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi)
  for (const panel of panelMatches ?? [raw]) {
    const rows = panel.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
    for (const tr of rows) {
      const cells = tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []
      if (cells.length < 3) continue
      const text = (c: string) => c.replace(/<[^>]+>/g, "").trim()
      const tld = text(cells[0] ?? "").toLowerCase().replace(/^\./, "")
      if ((cells[0] ?? "").includes("<th>") || !tld || !/^[a-z0-9\u00e0-\uffff-]{2,}$/.test(tld)) continue
      if (seen.has(tld)) continue
      const read = (c: string): number | null => {
        const m = text(c).replace(/[^\d.\s]/g, "").trim()
        if (!m) return null
        const n = Number.parseFloat(m.replace(/\s/g, ""))
        return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
      }
      const reg = read(cells[1] ?? "")
      const ren = read(cells[2] ?? "")
      if (reg == null && ren == null) continue
      const price: RawPrice = { tld, currency: "USD", sourceUrl: URL }
      if (reg != null) price.registerPrice = reg
      if (ren != null) price.renewPrice = ren
      seen.add(tld)
      out.push(price)
    }
  }
  if (out.length === 0) throw new Error("domaincostclub 解析结果为空(页面结构可能已变化)")
  return out
}

export const domaincostclubAdapter = defineAdapter({
  slug: "domaincostclub",
  name: "DomainCostClub",
  website: "https://www.domaincostclub.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  capabilities: { registration: true, renewal: true, supportedCurrencies: ["USD"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse: parseDcc,
    },
  ],
})