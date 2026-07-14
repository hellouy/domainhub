/**
 * Spaceship 适配器（Adapter SDK 2.0）—— JS 渲染示范
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源结论(2026-07):
 * Spaceship 的定价页是现代 SPA，价格表由 JS 动态渲染，直接 fetch
 * 拿到的 HTML 不含价格数字。因此首选 render 策略（外部无头浏览器，
 * 需配置 RENDERER_PROVIDER），等待价格表格渲染完成后再解析。
 *
 * 策略优先级（自动降级）:
 * 1. render —— 无头浏览器渲染后解析表格（首选；未配置渲染器时降级）
 * 2. html   —— 直连兜底（若站点未来提供 SSR 表格）
 *
 * 这是全项目 render 策略的参考实现：任何"必须执行 JS 才能拿到价格"
 * 的注册商都可照此声明 render 策略 + renderOptions。
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"
import { extractTableRows, findTldCell, parsePrice } from "./shared/table-adapter"

const PRICING_URL = "https://www.spaceship.com/domains/"

/** 从渲染后的 HTML 表格解析价格（注册 / 续费 / 转入 三列） */
function parseSpaceshipTable(html: string): RawPrice[] {
  const rows = extractTableRows(html)
  const prices: RawPrice[] = []
  const seen = new Set<string>()
  for (const cells of rows) {
    const hit = findTldCell(cells)
    if (!hit) continue
    const [tld, idx] = hit
    if (seen.has(tld)) continue
    const values: (number | null)[] = []
    for (let i = idx + 1; i < cells.length; i++) values.push(parsePrice(cells[i], "en"))
    if (values.every((v) => v === null)) continue
    const [register = null, renew = null, transfer = null] = values
    if (register == null && renew == null && transfer == null) continue
    seen.add(tld)
    prices.push({
      tld,
      registerPrice: register,
      renewPrice: renew,
      transferPrice: transfer,
      currency: "USD",
      sourceUrl: PRICING_URL,
    })
  }
  if (prices.length === 0) throw new Error("Spaceship 渲染后表格解析结果为空（页面结构可能已变化）")
  return prices
}

export const spaceshipAdapter = defineAdapter({
  slug: "spaceship",
  name: "Spaceship",
  website: "https://www.spaceship.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  priority: 40,
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    dnssec: true,
    whoisPrivacy: true,
    nameservers: true,
    api: false,
    premiumDomains: false,
    coupons: false,
    affiliate: false,
    marketplace: false,
    supportedCurrencies: ["USD"],
    supportedLanguages: ["en"],
  },
  rateLimit: { concurrency: 1, rpm: 6, retries: 2, timeoutMs: 90_000 },
  strategies: [
    {
      // 首选：外部无头浏览器渲染，等待价格表格出现后取 HTML
      type: "render",
      url: PRICING_URL,
      renderOptions: {
        waitUntil: "networkidle",
        waitFor: "table",
        timeoutMs: 45_000,
      },
      parse(raw): RawPrice[] {
        return parseSpaceshipTable(raw)
      },
    },
    {
      // 兜底：直连（若未来提供 SSR 表格）
      type: "html",
      url: PRICING_URL,
      parse(raw): RawPrice[] {
        return parseSpaceshipTable(raw)
      },
    },
  ],
})
