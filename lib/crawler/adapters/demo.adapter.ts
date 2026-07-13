import { SEED_PRICES, SEED_SOURCE_URLS } from "../seed-data"
import type { CrawlContext, DomainPrice, RawContent } from "../types"
import type { RawRecord } from "@/services/parser"
import { BaseAdapter } from "./base.adapter"

/**
 * DemoAdapter —— 用种子数据走完整生命周期，验证框架架构
 *
 * fetch() 将种子价格表序列化为 JSON RawContent，随后经过与真实
 * Adapter 完全相同的 parse -> normalize -> save 流水线。
 * 仅用于架构验证与未接入真实采集的注册商占位，不代表实时价格。
 */
export class DemoAdapter extends BaseAdapter {
  readonly strategy = "Demo（种子数据，全生命周期演练）"

  constructor(
    readonly slug: string,
    readonly name: string,
  ) {
    super()
  }

  protected async fetch(ctx: CrawlContext): Promise<RawContent> {
    const table = SEED_PRICES[this.slug]
    if (!table) throw new Error(`未找到 ${this.slug} 的种子价格数据`)
    await ctx.log("info", `Demo 数据源就绪：${Object.keys(table).length} 个后缀`)
    return {
      kind: "json",
      body: JSON.stringify(table),
      sourceUrl: SEED_SOURCE_URLS[this.slug] ?? "seed://demo",
    }
  }

  protected normalize(records: RawRecord[], _ctx: CrawlContext): DomainPrice[] {
    const source = SEED_SOURCE_URLS[this.slug] ?? "seed://demo"
    const checkedAt = new Date()
    // ±2% 抖动模拟市场波动，保留两位小数
    const jitter = (v: number | null) =>
      v === null ? null : Math.round(v * (1 + (Math.random() * 0.04 - 0.02)) * 100) / 100

    const result: DomainPrice[] = []
    for (const r of records) {
      // 种子表结构 { tld: [register, renew, transfer] }，经 Parser 得 { key, value } 或数组字段
      const tld = this.toTld(r.key)
      const tuple = Array.isArray(r.value) ? r.value : [r["0"], r["1"], r["2"]]
      if (!tld || !Array.isArray(tuple)) continue
      result.push({
        registrar: this.slug,
        tld,
        register_price: jitter(this.toPrice(tuple[0])),
        renew_price: jitter(this.toPrice(tuple[1])),
        transfer_price: jitter(this.toPrice(tuple[2])),
        currency: "USD",
        source,
        checked_at: checkedAt,
      })
    }
    return result
  }
}
