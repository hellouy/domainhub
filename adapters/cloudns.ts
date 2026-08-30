/**
 * ClouDNS 适配器
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 域名价格页为 JS 渲染（fetch 无数据表），全量价表 1200+ 行
 * （注册/续费/转入三类价，EUR）。通过 browser-worker 的
 * extract-json 形态取表（表格优先的提取脚本），SDK 默认 parse
 * 直接消费规范化输出。
 */
import { defineAdapter } from "@/packages/adapter-sdk"

export const cloudnsAdapter = defineAdapter({
  slug: "cloudns",
  name: "ClouDNS",
  website: "https://www.cloudns.net",
  version: "1.0.0",
  parserVersion: "1.0.0",
  owner: "Data Team",
  currency: "EUR",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["EUR"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 2, timeoutMs: 120_000 },
  strategies: [
    {
      type: "playwright",
      url: "https://www.cloudns.net/domains/",
      browser: {
        extract: "extract-json",
        waitForTimeoutMs: 20_000,
        scrollToBottom: true,
      },
    },
  ],
})