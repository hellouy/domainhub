/**
 * West.cn 适配器（西部数码）
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 浏览器提取全量价格页 `/web/price/domainpricelist`（Element UI el-table，JS 注入，fetch 无 SSR 行）。
 * 列结构：域名 | 注册价格 | 续费价格 | 转入价格 | 操作。
 *
 * 单元格为 El-popover 促销结构：隐藏的 year-list（1年/3年/5年/10年）+ 可见参考价。
 * 通用 extract-json 会把注册格的原价（old-price）和续费格隐藏的多年限价一起拼坏，
 * 因此用自定义 script 精确定位可视 1 年价：
 *   - 注册 column_3 = old-price 为标准注册价，.price 为促销价（cur < old 时分别落库）
 *   - 续费 column_4 = `.el-popover__reference .price`
 *   - 转入 column_5 = `.price`
 */
import { defineAdapter } from "@/packages/adapter-sdk"
import { validatePrices } from "@/packages/adapter-sdk/validation"

const WEST_SCRIPT = `(() => {
  const num = (el) => {
    if (!el) return null
    const raw = (el.textContent || "").trim()
    const t = raw.replace(/[^\\d.,]/g, "")
    if (!t) return null
    const lastDot = t.lastIndexOf(".")
    const lastComma = t.lastIndexOf(",")
    const sep = Math.max(lastDot, lastComma)
    const da = sep >= 0 ? t.slice(sep + 1).length : 0
    let s = t
    if (sep >= 0 && da === 3) s = t.replace(/[.,\\s\\u00a0]/g, "")
    else if (lastComma > lastDot) s = t.replace(/[.\\s\\u00a0]/g, "").replace(",", ".")
    else s = t.replace(/[,\\s\\u00a0]/g, "")
    const v = parseFloat(s)
    return Number.isFinite(v) && v > 0 && v < 1000000 ? Math.round(v * 100) / 100 : null
  }
  const out = []
  for (const tr of document.querySelectorAll("table.el-table__body tr")) {
    const tds = tr.querySelectorAll("td")
    if (!tds.length) continue
    const m = (tr.querySelector(".cell")?.textContent || "").trim().toLowerCase().match(/^.?([a-z0-9-]{2,20}(?:\\.[a-z0-9-]{2,15}){0,2})(?:\\s|$)/)
    if (!m) continue
    const row = { tld: m[1], register: null, renew: null, transfer: null, promotionPrice: null, promotion: false }
    for (const td of tds) {
      const cls = td.className || ""
      if (cls.includes("column_3")) {
        const ref = td.querySelector(".el-popover__reference")
        const old = num(ref?.querySelector(".old-price"))
        const cur = num(ref?.querySelector(".price"))
        if (old != null && cur != null && cur < old) {
          row.register = old
          row.promotionPrice = cur
          row.promotion = true
        } else {
          row.register = cur ?? old
        }
      }
      else if (cls.includes("column_4")) row.renew = num(td.querySelector(".el-popover__reference .price")) ?? num(td.querySelector("span.price"))
      else if (cls.includes("column_5")) row.transfer = num(td.querySelector(".price")) ?? num(td.querySelector(".cell"))
    }
    out.push(row)
  }
  return JSON.stringify(out)
})()`

export const westcnAdapter = defineAdapter({
  slug: "westcn",
  name: "West.cn（西部数码）",
  website: "https://www.west.cn",
  version: "2.1.0",
  parserVersion: "2.1.0",
  owner: "Data Team",
  currency: "CNY",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["CNY"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 2, timeoutMs: 120_000 },
  strategies: [
    {
      type: "playwright",
      url: "https://www.west.cn/web/price/domainpricelist",
      browser: {
        extract: "extract-json",
        script: WEST_SCRIPT,
        waitForTimeoutMs: 20_000,
        scrollToBottom: true,
      },
    },
  ],
  hooks: {
    async validate(prices) {
      return validatePrices(prices, "CNY")
    },
  },
})