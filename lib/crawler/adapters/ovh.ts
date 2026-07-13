import type { CrawlContext, DomainPrice, RawContent } from "../types"
import type { RawRecord } from "@/services/parser"
import { BaseAdapter } from "./base.adapter"

/**
 * OVH 真实价格 Adapter
 *
 * 数据源优先级探测结论（2026-07）：
 * 1. 官方公开目录 API：api.ovh.com/1.0/order/catalog/public/domain?ovhSubsidiary=IE ——
 *    OVH 官方订购目录（GET、无需鉴权），返回 900+ 后缀的完整报价（EUR 计价），
 *    是最高优先级来源。✓（约 30MB，需在 fetch 阶段瘦身后再交给 Parser）
 * 2. HTML / Playwright：无需退化。
 *
 * 结构：plans[] -> { invoiceName: ".com", pricings: [{ phase, interval,
 *   capacities: ["installation"|"renew"|...], mode, price(1e-8 EUR) }] }
 */

const API_URL = "https://api.ovh.com/1.0/order/catalog/public/domain?ovhSubsidiary=IE"

/** OVH 价格单位是 1e-8 欧元 */
const PRICE_DIVISOR = 100_000_000

interface OvhPricing {
  phase?: number
  interval?: number
  capacities?: string[]
  mode?: string
  price?: number
}

interface OvhPlan {
  invoiceName?: string
  pricings?: OvhPricing[]
}

export class OvhAdapter extends BaseAdapter {
  readonly slug = "ovh"
  readonly name = "OVH"
  readonly strategy = "真实数据（OVH 官方订购目录 API，EUR 计价）"

  /** 目录约 30MB，放宽超时 */
  protected readonly fetchTimeoutMs = 120_000

  protected async fetch(ctx: CrawlContext): Promise<RawContent> {
    const text = await this.httpGet(API_URL, ctx)
    // 信封拆解 + 瘦身：30MB 目录裁剪成 { tld: { register, renew, transfer } }
    let catalog: { plans?: OvhPlan[] }
    try {
      catalog = JSON.parse(text)
    } catch {
      throw new Error("目录 API 返回内容不是合法 JSON")
    }
    const plans = catalog.plans ?? []
    if (plans.length === 0) throw new Error("目录 API 返回空 plans 列表")
    await ctx.log("info", `目录包含 ${plans.length} 个 plan，开始提取年度价格`)

    const compact: Record<string, { register: number | null; renew: number | null; transfer: number | null }> = {}
    for (const plan of plans) {
      const invoiceName = plan.invoiceName ?? ""
      if (!invoiceName.startsWith(".")) continue
      // IDN 后缀形如 ".xn--6frz82g (.移动)"，取第一个空格前的纯 punycode 部分
      const tld = invoiceName.slice(1).toLowerCase().split(" ")[0]
      let register: number | null = null
      let renew: number | null = null
      let transfer: number | null = null
      for (const p of plan.pricings ?? []) {
        // 只取首年（phase 0、12 个月周期）的报价
        if (p.phase !== 0 || p.interval !== 12) continue
        const caps = p.capacities ?? []
        const price = typeof p.price === "number" ? p.price / PRICE_DIVISOR : 0
        if (price <= 0) continue
        if (p.mode === "create-default" && caps.includes("installation")) register = price
        if (caps.includes("renew") && (p.mode === "default" || renew === null)) renew = price
        if (caps.includes("transfer") && transfer === null) transfer = price
      }
      if (register !== null || renew !== null) {
        compact[tld] = { register, renew, transfer }
      }
    }
    return { kind: "json", body: JSON.stringify(compact), sourceUrl: API_URL }
  }

  protected normalize(records: RawRecord[], _ctx: CrawlContext): DomainPrice[] {
    const checkedAt = new Date()
    const result: DomainPrice[] = []
    for (const r of records) {
      const tld = this.toTld(r.key)
      const register = this.toPrice(r.register)
      const renew = this.toPrice(r.renew)
      const transfer = this.toPrice(r.transfer)
      if (!tld || (register === null && renew === null)) continue
      result.push({
        registrar: this.slug,
        tld,
        register_price: register,
        renew_price: renew,
        transfer_price: transfer,
        currency: "EUR",
        source: API_URL,
        checked_at: checkedAt,
      })
    }
    return result
  }
}

export const ovhAdapter = new OvhAdapter()
