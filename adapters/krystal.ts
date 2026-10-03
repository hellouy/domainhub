/**
 * Krystal Hosting 适配器（英国 .uk 注册商，GBP）
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源: 定价页 https://krystal.uk/domains 服务端渲染 TLD 价格表。
 * 价格列为注册价/续费价，无转入价。页面为 JS 渲染，用 playwright
 * extract-json（项目内置提取器识别"TLD + 数字价格"行）取数。
 */
import { defineAdapter } from "@/packages/adapter-sdk"

export const krystalAdapter = defineAdapter({
  slug: "krystal",
  name: "Krystal",
  website: "https://krystal.uk",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "GBP",
  priority: 50,
  capabilities: {
    registration: true,
    renewal: true,
    transfer: false,
    supportedCurrencies: ["GBP"],
  },
  rateLimit: { concurrency: 1, rpm: 8, retries: 2, timeoutMs: 60_000 },
  strategies: [
    {
      type: "playwright",
      url: "https://krystal.uk/domains",
      browser: { extract: "extract-json", waitForTimeoutMs: 25_000, scrollToBottom: true },
    },
  ],
})