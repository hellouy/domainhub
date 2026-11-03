/**
 * BizCN（商务中国，商中在线）— 价格 JSON API（97 个 TLD，CNY）
 * ------------------------------------------------------------
 * 源: https://www.bizcn.com/show/support/price.do（Vue 页面，表格由该接口渲染）
 * 接口: POST /show/domain/search/queryDomainPrice.do（form: pfid=1）
 * 返回: { code: 200, data: { manageList: [{ suffix, registerPrice, renewPrice, transferPrice, startDateStr, endDateStr }] } }
 *
 * 注:
 * - pfid=1 是页面默认展示的「商务中国」价格体系；pfid=3 为「新互」体系（98 TLD，价格不同），未采用。
 * - 全表统一按月生效（如 2026-11-01~11-30），注册价为当月挂牌价；无独立促销列，
 *   部分新顶级域注册价远低于续费价（首年促销特征），按挂牌价直映，不做促销猜测。
 */
import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const PAGE_URL = "https://www.bizcn.com/show/support/price.do"
const API_URL = "https://www.bizcn.com/show/domain/search/queryDomainPrice.do"

interface BizCnRow {
  suffix: string
  registerPrice: number | null
  renewPrice: number | null
  transferPrice: number | null
}

const toNum = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null

export const bizcnAdapter = defineAdapter({
  slug: "bizcn",
  name: "BizCN",
  website: "https://www.bizcn.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "CNY",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["CNY"] },
  rateLimit: { concurrency: 1, rpm: 30, retries: 2, timeoutMs: 30_000 },
  strategies: [
    {
      type: "json",
      url: API_URL,
      async fetch(ctx: AdapterContext): Promise<string> {
        const res = await ctx.fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            Referer: PAGE_URL,
          },
          body: "pfid=1",
        })
        if (!res.ok) throw new Error(`BizCN API HTTP ${res.status}`)
        return res.text()
      },
      parse(raw: string): RawPrice[] {
        const parsed = JSON.parse(raw)
        if (parsed?.code !== 200 || !Array.isArray(parsed?.data?.manageList)) {
          throw new Error(`BizCN API unexpected response: ${raw.slice(0, 100)}`)
        }
        const out: RawPrice[] = []
        for (const row of parsed.data.manageList as BizCnRow[]) {
          if (!row.suffix) continue
          const registerPrice = toNum(row.registerPrice)
          const renewPrice = toNum(row.renewPrice)
          const transferPrice = toNum(row.transferPrice)
          if (registerPrice == null && renewPrice == null && transferPrice == null) continue
          out.push({
            tld: row.suffix.replace(/^\./, "").toLowerCase(),
            currency: "CNY",
            registerPrice,
            renewPrice,
            transferPrice,
            sourceUrl: PAGE_URL,
          })
        }
        if (out.length === 0) throw new Error("BizCN API returned no valid price rows")
        return out
      },
    },
  ],
})
