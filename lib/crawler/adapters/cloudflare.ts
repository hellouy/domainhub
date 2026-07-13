import type { CrawlContext, DomainPrice, RawContent } from "../types"
import type { RawRecord } from "@/services/parser"
import { BaseAdapter } from "./base.adapter"

/**
 * Cloudflare Registrar 真实价格 Adapter
 *
 * 数据源优先级探测结论（2026-07）：
 * 1. 官方 API：Cloudflare 未提供公开的注册商定价 API（定价接口在 dash 后需登录）。
 * 2. JSON 端点：cfdomainpricing.com/prices.json —— 社区持续维护的
 *    Cloudflare Registrar 全量定价数据集（约 400+ 后缀，含更新日期），
 *    这是当前最可靠的机器可读来源，故采用。✓
 * 3. HTML 解析 / Playwright：Cloudflare 官网 tld-policies 页面仅含注册局
 *    政策信息，不含价格，客户端渲染，无需退化到此方案。
 *
 * Cloudflare Registrar 按批发价（成本价）销售：
 * 转入（transfer）价格与续费（renew）价格一致。
 */

const SOURCE_URL = "https://cfdomainpricing.com/prices.json"

export class CloudflareAdapter extends BaseAdapter {
  readonly slug = "cloudflare"
  readonly name = "Cloudflare"
  readonly strategy = "真实数据（cfdomainpricing.com JSON 数据集）"

  protected async fetch(ctx: CrawlContext): Promise<RawContent> {
    const body = await this.httpGet(SOURCE_URL, ctx)
    return { kind: "json", body, sourceUrl: SOURCE_URL }
  }

  protected normalize(records: RawRecord[], _ctx: CrawlContext): DomainPrice[] {
    const checkedAt = new Date()
    const result: DomainPrice[] = []
    for (const r of records) {
      const tld = this.toTld(r.key)
      const register = this.toPrice(r.registration)
      const renew = this.toPrice(r.renewal)
      if (!tld || (register === null && renew === null)) continue
      result.push({
        registrar: this.slug,
        tld,
        register_price: register,
        renew_price: renew,
        // Cloudflare 按成本价销售，转入价与续费价一致
        transfer_price: renew,
        currency: "USD",
        source: SOURCE_URL,
        checked_at: checkedAt,
      })
    }
    return result
  }
}

export const cloudflareAdapter = new CloudflareAdapter()
