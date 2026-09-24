/**
 * West.cn 适配器（西部数码）
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 浏览器提取全量价格页 `/web/price/domainpricelist`（JS 注入表格，fetch 无 SSR 行）。
 * 列结构：域名 | 注册价格 | 续费价格 | 转入价格 | 操作。
 *
 * 注册价格单元格为混合促销文案（"1年 ¥79 3年 ¥257 … 原价 ¥86"），提取值由多个
 * 数字拼接而成而不可靠，因此在 hooks.validate 中清洗：清空 registerPrice（促销），
 * 保留真实续费/转入价，再走默认校验平台。
 */
import { defineAdapter } from "@/packages/adapter-sdk"
import { validatePrices } from "@/packages/adapter-sdk/validation"

export const westcnAdapter = defineAdapter({
  slug: "westcn",
  name: "West.cn（西部数码）",
  website: "https://www.west.cn",
  version: "1.0.0",
  parserVersion: "1.0.0",
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
        waitForTimeoutMs: 15_000,
        scrollToBottom: true,
      },
    },
  ],
  hooks: {
    async validate(prices, ctx) {
      const clean = prices.map((p) => ({ ...p, registerPrice: null }))
      return validatePrices(clean, "CNY")
    },
  },
})