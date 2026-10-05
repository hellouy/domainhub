/**
 * Name.com 适配器(Adapter SDK 2.0)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源: https://www.name.com/pricing
 *  - 服务端 HTML 为未渲染模板(含 <%- %> 占位符), 本身不含价目表。
 *  - /ajax/pricing 有会话校验(直采与 worker 重放均返回 400)。
 *  - 价格由前端 JS 从内嵌数据数组渲染 → 必须用 playwright 渲染后解析 DOM。
 *
 * 渲染后每行 `div.row.pricerow` 含 5 个 `.col-xs-2`:
 *   [0] 年限("1 Year" / "1 Year SALE")
 *   [1] 注册价: "$12.99 $17.99" = (促销价 原价); 无促销时为单值
 *   [2] 续费价(可能带 "This price will change to ..." 提示, 取首值)
 *   [3] 转入价
 *   [4] 赎回价(忽略)
 * TLD 取行内 `href="/domains/<tld>"`。
 * 币种 USD。验证: 586 TLD, .com 注册 17.99 / 促销 12.99 / 续费 19.99。
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const PAGE_URL = "https://www.name.com/pricing"

/** 提取单元格中所有 "12,345.67" 形式的金额 */
function amounts(text: string): number[] {
  return [...text.matchAll(/([0-9][0-9,]*\.[0-9]{2})/g)]
    .map((m) => Number.parseFloat(m[1].replace(/,/g, "")))
    .filter((v) => Number.isFinite(v) && v > 0)
}

export function parseNamecomHtml(raw: string): RawPrice[] {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  for (const seg of raw.split(/class="row pricerow"/).slice(1)) {
    const tldRaw = (seg.match(/href="\/domains\/([a-z0-9.-]+)"/i) || [])[1]
    if (!tldRaw) continue
    const tld = tldRaw.replace(/^\./, "").toLowerCase()
    if (!/^[a-z0-9][a-z0-9.-]*$/.test(tld) || seen.has(tld)) continue
    const cols = [...seg.matchAll(/<div class="col-xs-2">([\s\S]*?)<\/div>/gi)].map((m) =>
      m[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    if (cols.length < 3) continue
    const reg = amounts(cols[1])
    if (reg.length === 0) continue
    const renew = amounts(cols[2])[0] ?? null
    const transfer = cols[3] ? amounts(cols[3])[0] ?? null : null
    const price: RawPrice = { tld, currency: "USD", sourceUrl: PAGE_URL }
    if (reg.length >= 2 && reg[1] > reg[0]) {
      price.registerPrice = reg[1]
      price.promotionPrice = reg[0]
    } else {
      price.registerPrice = reg[0]
    }
    if (renew != null) price.renewPrice = renew
    if (transfer != null) price.transferPrice = transfer
    seen.add(tld)
    out.push(price)
  }
  if (out.length < 100) throw new Error(`Name.com 渲染解析行数异常: ${out.length}(页面结构可能已变化)`)
  return out
}

export const namecomAdapter = defineAdapter({
  slug: "namecom",
  name: "Name.com",
  website: "https://www.name.com",
  owner: "Data Team",
  version: "1.0.1",
  parserVersion: "1.0.1",
  currency: "USD",
  priority: 40,
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    premiumDomains: true,
    dnssec: true,
    whoisPrivacy: true,
    api: true,
    supportedCurrencies: ["USD"],
    supportedLanguages: ["en"],
  },
  rateLimit: { concurrency: 1, rpm: 10, retries: 2, timeoutMs: 60_000 },
  strategies: [
    {
      type: "playwright",
      url: PAGE_URL,
      browser: {
        extract: "html",
        scrollToBottom: true,
        waitForTimeoutMs: 15_000,
      },
      parse: parseNamecomHtml,
    },
  ],
})
