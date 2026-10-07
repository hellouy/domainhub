/**
 * forpsi.com 适配器（捷克 CZK，SSR 表格直连）
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * https://www.forpsi.com/domain/ 为 SSR 表格（直连 502KB 含 241 行），5 列：
 * [TLD+标志, 1 rok(期限), akce(促销价，仅 8 行有值), 注册价, 续费价]。
 * 价格为捷克克朗，形如 "700,00 Kč 847,00 vč. DPH"（不含税/含税双价），
 * parsePrice eu 口径取首值=不含税价。akce 列有值且低于注册价时作为 promotionPrice。
 */
import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"
import { extractTableRows, findTldCell, parsePrice } from "@/adapters/shared/table-adapter"

const PAGE_URL = "https://www.forpsi.com/domain/"

export const forpsiAdapter = defineAdapter({
  slug: "forpsi",
  name: "Forpsi",
  website: "https://www.forpsi.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "CZK",
  priority: 50,
  capabilities: { registration: true, renewal: true, transfer: false, supportedCurrencies: ["CZK"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 2, timeoutMs: 120_000 },
  strategies: [
    {
      type: "html",
      url: PAGE_URL,
      async fetch(ctx) {
        const res = await ctx.fetch(PAGE_URL, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            Accept: "text/html",
          },
        })
        if (!res.ok) throw new Error(`forpsi 价格页返回 HTTP ${res.status}`)
        return res.text()
      },
      parse(raw): RawPrice[] {
        const rows = extractTableRows(raw)
        const prices: RawPrice[] = []
        const seen = new Set<string>()
        for (const cells of rows) {
          if (!/^\.[a-z]/i.test((cells[0] ?? "").trim())) continue
          const tldHit = findTldCell(cells)
          if (!tldHit) continue
          const [tld] = tldHit
          if (seen.has(tld)) continue
          // 第 3 列(注册, 不含税)与第 4 列(续费, 不含税); 第 2 列是 akce 促销价
          const registerPrice = parsePrice(cells[3] ?? "", "eu")
          const renewPrice = parsePrice(cells[4] ?? "", "eu")
          if (registerPrice == null && renewPrice == null) continue
          const promo = parsePrice(cells[2] ?? "", "eu")
          const price: RawPrice = {
            tld,
            currency: "CZK",
            sourceUrl: PAGE_URL,
            registerPrice,
            renewPrice,
          }
          if (promo != null && registerPrice != null && promo < registerPrice) {
            price.promotionPrice = promo
          }
          seen.add(tld)
          prices.push(price)
        }
        if (prices.length === 0) throw new Error("forpsi 表格解析结果为空(页面结构可能已变化)")
        return prices
      },
    },
  ],
})
