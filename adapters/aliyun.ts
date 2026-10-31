/**
 * 阿里云·万网（wanwang.aliyun.com）—— 中国最大注册商价目(CNY)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://wanwang.aliyun.com/help/price.html（低代码 ACE 框架页, 价格由运行时 JS 渲染）
 *
 * 页面是 Ace 低代码 SPA，表格不存在于 HTML，需 Playwright 渲染后提取。
 * 旧 createTableAdapter（html + anti-bot 策略）因页面结构变化已失效（2026-10-30）。
 */
import { defineAdapter } from "@/packages/adapter-sdk"
import { validatePrices } from "@/packages/adapter-sdk/validation"

const ALIYUN_SCRIPT = `(() => {
  const num = (el) => {
    if (!el) return null
    const raw = (el.textContent || "").trim()
    const t = raw.replace(/[^\\d.,\\s\\u00a0]/g, "")
    if (!t) return null
    const lastDot = t.lastIndexOf(".")
    const lastComma = t.lastIndexOf(",")
    const sep = Math.max(lastDot, lastComma)
    const da = sep >= 0 ? t.slice(sep + 1).length : 0
    let s = t
    if (sep >= 0 && da === 3) s = t.replace(/[.,\\s\\u00a0]/g, "")
    else if (lastComma > lastDot) s = t.replace(/[.]\\s\\u00a0]/g, "").replace(",", ".")
    else s = t.replace(/[,\\s\\u00a0]/g, "")
    const v = parseFloat(s)
    return Number.isFinite(v) && v > 0 && v < 1000000 ? Math.round(v * 100) / 100 : null
  }
  const out = []
  for (const table of document.querySelectorAll("table")) {
    const rows = table.querySelectorAll("tr")
    for (const tr of rows) {
      const tds = tr.querySelectorAll("td, th")
      if (tds.length < 11) continue
      const first = (tds[0].textContent || "").trim()
      const m = first.match(/^\\.?([a-z0-9-]+(?:\\.[a-z0-9-]{1,10}){0,2})\\s*$/i)
      if (!m) continue
      const tld = m[1].toLowerCase()
      const cells = Array.from(tds).map(td => (td.textContent || "").trim())
      // column mapping: 0=TLD, 1=register, 2-4=register yrs, 5=renew, 6-8=renew yrs, 9=transfer, 10=restore
      const registerRaw = cells[1] || ""
      const renewRaw = cells[5] || ""
      const transferRaw = cells[9] || ""
      const restoreRaw = cells[10] || ""
      // dual-value detection: "促销价 原价" order (same reversal logic as original)
      const promoMatch = registerRaw.match(/^(\\d+(?:\\.\\d+)?)\\s*元\\s+(\\d+(?:\\.\\d+)?)\\s*元$/)
      let register = num(tds[1])
      let promotionPrice = null
      let promotion = false
      if (promoMatch && parseFloat(promoMatch[1]) < parseFloat(promoMatch[2])) {
        register = parseFloat(promoMatch[2])
        promotionPrice = parseFloat(promoMatch[1])
        promotion = true
      }
      out.push({
        tld,
        register,
        renewal: num(tds[5]),
        transfer: num(tds[9]),
        restore: num(tds[10]),
        promotionPrice,
        promotion,
      })
    }
  }
  return JSON.stringify(out)
})()`

export const aliyunAdapter = defineAdapter({
  slug: "aliyun",
  name: "阿里云(万网) Aliyun",
  website: "https://wanwang.aliyun.com",
  version: "3.0.0",
  parserVersion: "3.0.0",
  owner: "Data Team",
  currency: "CNY",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["CNY"] },
  rateLimit: { concurrency: 1, rpm: 6, retries: 3, timeoutMs: 120_000 },
  strategies: [
    {
      type: "playwright",
      url: "https://wanwang.aliyun.com/help/price.html",
      browser: {
        extract: "extract-json",
        script: ALIYUN_SCRIPT,
        waitForTimeoutMs: 25_000,
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
