/**
 * ClouDNS 适配器
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 定价页 `/domain-pricing-list/` 为 JS 渲染（表格内容通过 AJAX 动态加载，
 * fetch 无 SSR 数据）。初始 HTML 包含 TLD 下拉选项（1200+ 个 TLD），
 * 价格数据需通过选择 TLD 后触发加载，或查找定价 API。
 *
 * 当前策略：使用 playwright 等待 JS 渲染后提取 HTML，
 * parse 函数从 select#domain-search-tld 中提取 TLD 列表。
 * 价格数据需要在后续步骤中通过其他方式获取。
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
      url: "https://www.cloudns.net/domain-pricing-list/",
      browser: {
        extract: "html",
        waitForTimeoutMs: 20_000,
        scrollBottom: true,
        parse(html) {
          const tlds = []
          const seen = new Set()
          const optionRegex = /<option[^>]*value="([^">]+)"[^>]*>/g
          let match
          while ((match = optionRegex.exec(html)) !== null) {
            const tld = match[1].trim()
            if (tld && !seen.has(tld) && !tld.includes(" ") && tld.length > 1) {
              seen.add(tld)
              tlds.push(tld)
            }
          }
          return tlds.map(tld => ({ tld }))
        },
      },
    },
  ],
})