import type { CrawlContext, DomainPrice, RawContent } from "../types"
import type { RawRecord } from "@/services/parser"
import { BaseAdapter } from "./base.adapter"

/**
 * Porkbun 真实价格 Adapter
 *
 * 数据源优先级探测结论（2026-07）：
 * 1. 官方 API：api.porkbun.com/api/json/v3/pricing/get ——
 *    Porkbun 官方公开定价接口（POST、无需鉴权），返回全量 900+ 后缀的
 *    注册/续费/转入价格，是最高优先级来源。✓
 * 2. JSON 端点 / HTML / Playwright：无需退化。
 *
 * 响应结构：{ status: "SUCCESS", pricing: { com: { registration, renewal, transfer }, ... } }
 */

const API_URL = "https://api.porkbun.com/api/json/v3/pricing/get"

export class PorkbunAdapter extends BaseAdapter {
  readonly slug = "porkbun"
  readonly name = "Porkbun"
  readonly strategy = "真实数据（Porkbun 官方定价 API）"

  protected async fetch(ctx: CrawlContext): Promise<RawContent> {
    const text = await this.httpPost(API_URL, ctx)
    // 仅做信封拆解（envelope unwrap），不做解析：把 pricing 子对象交给 Parser
    let envelope: { status?: string; pricing?: unknown }
    try {
      envelope = JSON.parse(text)
    } catch {
      throw new Error("官方 API 返回内容不是合法 JSON")
    }
    if (envelope.status !== "SUCCESS" || !envelope.pricing || typeof envelope.pricing !== "object") {
      throw new Error(`官方 API 返回异常状态：${envelope.status ?? "未知"}`)
    }
    return { kind: "json", body: JSON.stringify(envelope.pricing), sourceUrl: API_URL }
  }

  protected normalize(records: RawRecord[], _ctx: CrawlContext): DomainPrice[] {
    const checkedAt = new Date()
    const result: DomainPrice[] = []
    for (const r of records) {
      const tld = this.toTld(r.key)
      const register = this.toPrice(r.registration)
      const renew = this.toPrice(r.renewal)
      const transfer = this.toPrice(r.transfer)
      if (!tld || (register === null && renew === null)) continue
      result.push({
        registrar: this.slug,
        tld,
        register_price: register,
        renew_price: renew,
        transfer_price: transfer,
        currency: "USD",
        source: API_URL,
        checked_at: checkedAt,
      })
    }
    return result
  }
}

export const porkbunAdapter = new PorkbunAdapter()
