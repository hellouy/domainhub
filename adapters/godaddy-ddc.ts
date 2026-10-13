/**
 * GoDaddy 折扣域名俱乐部(DDC)价格 — se.godaddy.com 会员价(SEK)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://se.godaddy.com/domains/discount-domain-club
 * 直连被 Akamai TLS 拦截 → anti-bot 策略走聚合服务(CRAWL_SERVICE_URL)渲染。
 *
 * 渲染后为 GoDaddy ux-table 标准表, 每 TLD 行 5 列:
 *   TLD | ordinarie 价(非会员) | DDC Baspris | DDC Premium | DDC Domain Pro
 * 每价格格两个 span: ddc-price-member(注册价) + ddc-price-renews("Förnyas för X kr"续费价)
 * 取 DDC Baspris 列(第 3 格, 会员日常价)作 register/renew。
 * 货币 SEK, 数字格式 "98,00 kr"(逗号小数, eu 格式)。
 */
import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"
import { extractTableRows, parseDualPrice, findTldCell } from "./shared/table-adapter"

export const godaddyDdcAdapter = defineAdapter({
  slug: "godaddy-ddc",
  name: "GoDaddy Discount Domain Club",
  website: "https://se.godaddy.com/domains/discount-domain-club",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "SEK",
  priority: 45,
  capabilities: {
    registration: true,
    renewal: true,
    supportedCurrencies: ["SEK"],
    supportedLanguages: ["sv"],
  },
  rateLimit: { concurrency: 1, rpm: 6, retries: 2, timeoutMs: 120_000 },
  strategies: [
    {
      type: "anti-bot",
      url: "https://se.godaddy.com/domains/discount-domain-club",
      antiBot: { keyword: "Förnyas för" },
      async parse(raw: string): Promise<RawPrice[]> {
        const rows = extractTableRows(raw)
        const prices: RawPrice[] = []
        const seen = new Set<string>()
        for (const cells of rows) {
          const hit = findTldCell(cells)
          if (!hit) continue
          const [tld, idx] = hit
          if (seen.has(tld)) continue
          // DDC Baspris 列: 第 3 格(TLD 后第 2 格)
          const basicCell = cells[idx + 2]
          if (!basicCell) continue
          const [reg, renew] = parseDualPrice(basicCell, "eu")
          if (reg == null) continue
          seen.add(tld)
          const p: RawPrice = {
            tld,
            currency: "SEK",
            sourceUrl: "https://se.godaddy.com/domains/discount-domain-club",
          }
          if (reg != null) p.registerPrice = reg
          if (renew != null) p.renewPrice = renew
          prices.push(p)
        }
        if (prices.length === 0) throw new Error("GoDaddy DDC 未解析出任何价格")
        return prices
      },
    },
  ],
})
