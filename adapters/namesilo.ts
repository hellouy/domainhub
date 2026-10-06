/**
 * Namesilo —— 美国注册商价目(USD, 多层级数量定价)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.namesilo.com/pricing (browser-probe 渲染成功, 139 行)
 * 表头: TLD | 1-49量级价 | 50-100量级价 | ... (多列)
 * 首列价格为标准零售价(1-49), 其余为批量折扣
 * 部分 TLD 有多价格列(标准/促消费)以空格分隔
 *  币种 USD。验证: 463 TLD, .com $17.29, .net $15.95, .top $4.88
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.namesilo.com/pricing"

function parseUsd(s: string | null | undefined): number | null {
  if (!s) return null
  const m = s.replace(/[^0-9.]/g, "")
  const v = Number.parseFloat(m)
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null
}

export const namesiloAdapter = defineAdapter({
  slug: "namesilo",
  name: "Namesilo",
  website: "https://www.namesilo.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  capabilities: {
    registration: true,
    renewal: true,
    transfer: false,
    supportedCurrencies: ["USD"],
  },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "playwright",
      url: URL,
      browser: {
        extract: "html",
        scrollToBottom: false,
        waitForTimeoutMs: 10_000,
      },
      async parse(raw: string): Promise<RawPrice[]> {
        const out: RawPrice[] = []
        const seen = new Set<string>()
        const tableMatch = raw.match(/<table[^>]*>([\s\S]*?)<\/table>/i)
        if (!tableMatch) throw new Error("Namesilo 页面未找到表格")
        const rows = tableMatch[1].match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []
        let headerCols = 0
        for (const row of rows) {
          const cells = [...row.matchAll(/<(td|th)[^>]*>([\s\S]*?)<\/(td|th)>/gi)].map(m =>
            m[2].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/[\s]+/g, " ").trim(),
          )
          if (cells.length === 0) continue
          // 第一行为表头
          if (headerCols === 0) {
            headerCols = cells.length
            const isTldHeader = cells[0]?.toLowerCase().includes("tld") || cells[0]?.toLowerCase().includes("domain")
            if (!isTldHeader) continue
            continue
          }
          if (cells.length < 2) continue
          const tldRaw = cells[0].replace(/^\./, "").toLowerCase().trim()
          if (!tldRaw || !/^[a-z0-9]/.test(tldRaw) || seen.has(tldRaw)) continue
          // 首列之后第一个有效数值列为注册价(1-49量级)
          let registerPrice: number | null = null
          let promoPrice: number | null = null
          for (let i = 1; i < cells.length; i++) {
            const cell = cells[i]
            // 跳过非价格列(如说明文字)
            if (!/[0-9]/.test(cell)) continue
            const nums = [...cell.matchAll(/(\$[\d.]+)/g)].map(m => parseUsd(m[1]))
            if (nums.length === 0) continue
            // 取最小数量列(1-49)的价格
            if (registerPrice === null) {
              registerPrice = nums[0]
              // 如果有两个价格,第二个是促消费(如 "$17.29 $8.75")
              if (nums.length >= 2 && nums[1]! < nums[0]!) {
                promoPrice = nums[1]
                registerPrice = nums[0]
              }
            }
            break // 只取第一个有效价格列
          }
          if (registerPrice === null) continue
          const price: RawPrice = { tld: tldRaw, currency: "USD", sourceUrl: URL }
          price.registerPrice = registerPrice
          if (promoPrice !== null) price.promotionPrice = promoPrice
          seen.add(tldRaw)
          out.push(price)
        }
        if (out.length < 50) throw new Error(`Namesilo 解析行数异常: ${out.length}`)
        return out
      },
    },
  ],
})
