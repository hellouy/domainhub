/**
 * CentralNic Reseller 适配器
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * CentralNic Reseller 官网批发价页（HEXONET 并入 CentralNic）。
 * 页面用 Grid.js（fromHTML）渲染 30 个热门 TLD 批发价（USD），
 * 自定义提取脚本直接收集 gridjs 行。有限子集，作为主源补充。
 */
import { defineAdapter } from "@/packages/adapter-sdk"

// 提取脚本：收集 gridjs-tr 行（tld/register/transfer/renew/restore，USD）
const extractScript = String.raw`(async () => {
  const rows = Array.from(document.querySelectorAll("tr.gridjs-tr"))
  const num = (s) => { const m = String(s || "").replace(/,/g, "").match(/[\\d.]+/); return m ? Number(m[0]) : null }
  return JSON.stringify(rows.map((tr) => {
    const tds = Array.from(tr.querySelectorAll("td.gridjs-td"))
    if (tds.length < 4) return null
    return {
      tld: tds[0].textContent.trim().replace(/^\\./, ""),
      register: num(tds[1].textContent),
      transfer: num(tds[2].textContent),
      renew: num(tds[3].textContent),
    }
  }).filter(Boolean))
})()`

export const centralnicAdapter = defineAdapter({
  slug: "centralnic",
  name: "CentralNic Reseller",
  website: "https://www.centralnicreseller.com",
  version: "1.0.0",
  parserVersion: "1.0.0",
  owner: "Data Team",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["USD"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 2, timeoutMs: 120_000 },
  strategies: [
    {
      type: "playwright",
      url: "https://www.centralnicreseller.com/domain-reseller-pricing/",
      browser: {
        extract: "extract-json",
        waitForTimeoutMs: 30_000,
        scrollToBottom: false,
        script: extractScript,
      },
    },
  ],
})