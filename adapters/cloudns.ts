/**
 * ClouDNS 适配器
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 定价页 `/domain-pricing-list/` 为 JS 动态渲染：初始 HTML 只有 TLD 下拉选项
 * （1249 个），真实价表由 AJAX 注入 `#domain-pricing-list-table` 内的 `<table>`。
 * 普通 fetch / direct 抓取拿到的 tbody 为空，必须经 browser-worker 渲染。
 *
 * 渲染后表格结构（tbody > tr.tlds，6 列）：
 *   td.a-l.tld        = TLD（如 .com）
 *   td[1]             = Registration（$15.69/y.）
 *   td[2]             = Transfer（$15.69，可能含 span.old 促销原价）
 *   td[3]             = Renewal（$15.69/y.）
 *   td[4]/td[5]       = Privacy / DNSSEC（图标）
 *
 * 用自定义 script 精确定位 tr.tlds 行，解析三列价格（去重 /y. 后缀），
 * 返回 browser-worker extract-json 规范形状（tld/register/renew/transfer）。
 */
import { defineAdapter } from "@/packages/adapter-sdk"

const CLOUDNS_SCRIPT = `(() => {
  const num = (s) => {
    if (!s) return null
    const t = String(s).replace(/<[^>]+>/g, " ").replace(/[^\\d.,]/g, "")
    if (!t) return null
    const v = parseFloat(t.replace(/,/g, ""))
    return Number.isFinite(v) && v > 0 && v < 1000000 ? Math.round(v * 100) / 100 : null
  }
  const out = []
  const container = document.querySelector("#domain-pricing-list-table") || document
  const rows = container.querySelectorAll("tbody tr.tlds")
  for (const tr of rows) {
    const tds = tr.querySelectorAll("td")
    if (tds.length < 4) continue
    const tld = (tds[0].textContent || "").trim().replace(/^\\./, "").toLowerCase()
    if (!tld || !/^[a-z0-9-]+(\\.[a-z0-9-]+)*$/.test(tld)) continue
    const register = num(tds[1].textContent)
    const transfer = num(tds[2].textContent)
    const renew = num(tds[3].textContent)
    if (register == null && renew == null && transfer == null) continue
    out.push({ tld, register, renew, transfer, promotion: false })
  }
  return JSON.stringify(out)
})()`

export const cloudnsAdapter = defineAdapter({
  slug: "cloudns",
  name: "ClouDNS",
  website: "https://www.cloudns.net",
  version: "2.0.0",
  parserVersion: "2.0.0",
  owner: "Data Team",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["USD"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 2, timeoutMs: 120_000 },
  strategies: [
    {
      type: "playwright",
      url: "https://www.cloudns.net/domain-pricing-list/",
      browser: {
        extract: "extract-json",
        script: CLOUDNS_SCRIPT,
        waitForTimeoutMs: 15_000,
        scrollToBottom: true,
      },
    },
  ],
})
