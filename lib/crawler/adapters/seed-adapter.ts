import { SEED_PRICES, SEED_SOURCE_URLS } from "../seed-data"
import type { CrawledPrice, RegistrarAdapter } from "../types"

/**
 * 种子数据 Adapter 工厂
 *
 * MVP 阶段用真实注册商定价水平的种子数据模拟采集流程，
 * 采集时对价格施加 ±2% 的微小抖动以模拟真实市场波动，
 * 后续可用真实爬虫/API Adapter（如 Porkbun 官方定价 API）平滑替换。
 */
export function createSeedAdapter(slug: string, name: string): RegistrarAdapter {
  return {
    slug,
    name,
    strategy: "种子数据（模拟采集）",
    async fetchPrices(ctx) {
      const table = SEED_PRICES[slug]
      if (!table) {
        await ctx.log("error", `未找到 ${slug} 的种子价格数据`)
        return []
      }
      await ctx.log("info", `开始采集 ${name}，共 ${Object.keys(table).length} 个后缀`)

      const results: CrawledPrice[] = []
      for (const [tld, [reg, renew, transfer]] of Object.entries(table)) {
        // ±2% 抖动，保留两位小数，模拟真实价格波动
        const jitter = (v: number | null) =>
          v === null ? null : Math.round(v * (1 + (Math.random() * 0.04 - 0.02)) * 100) / 100
        results.push({
          tld,
          registerPrice: jitter(reg),
          renewPrice: jitter(renew),
          transferPrice: jitter(transfer),
          currency: "USD",
          sourceUrl: SEED_SOURCE_URLS[slug],
        })
      }

      await ctx.log("info", `采集完成，获取 ${results.length} 条价格`)
      return results
    },
  }
}
