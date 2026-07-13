import type { CrawlContext, DomainPrice, RawContent } from "../types"
import type { RawRecord } from "@/services/parser"
import { BaseAdapter } from "./base.adapter"

/**
 * SampleAdapter —— 新增注册商的复制模板（未注册，不参与调度）
 *
 * 接入一个新注册商的完整步骤：
 *
 *   1. 复制本文件为 <slug>.adapter.ts，改类名与三个元信息字段
 *   2. 实现 fetch()：返回 RawContent（kind 为 json/html/xml + 原始文本）
 *   3. 实现 normalize()：把 Parser 产出的 RawRecord 映射为 DomainPrice
 *   4. 在 adapters/index.ts 的 realAdapters 数组中注册一行
 *   5. 确认 registrars 表中存在对应 slug 的记录
 *
 * 除此之外不需要修改任何其他代码。
 * 注意：禁止在 Adapter 中写解析逻辑（正则抽取 HTML、JSON.parse 等），
 * 统一由 Parser 服务完成；也禁止直接操作数据库，落库由 Storage 服务完成。
 */
export class SampleAdapter extends BaseAdapter {
  readonly slug = "sample"
  readonly name = "Sample Registrar"
  readonly strategy = "示例模板（JSON API）"

  /** 抓取：用基类的 httpGet（自带 60s 超时 + 3 次重试 + 取消检查） */
  protected async fetch(ctx: CrawlContext): Promise<RawContent> {
    const sourceUrl = "https://api.example.com/pricing.json"
    const body = await this.httpGet(sourceUrl, ctx)
    return { kind: "json", body, sourceUrl }
  }

  /** HTML 表格数据源时可指定表格序号；XML 时指定 recordTag */
  // protected parseOptions() { return { tableIndex: 0 } }

  /** 归一化：字段映射 + 校验，非法记录直接丢弃 */
  protected normalize(records: RawRecord[], _ctx: CrawlContext): DomainPrice[] {
    const checkedAt = new Date()
    const result: DomainPrice[] = []
    for (const r of records) {
      const tld = this.toTld(r.key ?? r.tld)
      const register = this.toPrice(r.registration ?? r.register)
      const renew = this.toPrice(r.renewal ?? r.renew)
      if (!tld || (register === null && renew === null)) continue
      result.push({
        registrar: this.slug,
        tld,
        register_price: register,
        renew_price: renew,
        transfer_price: this.toPrice(r.transfer),
        currency: "USD",
        source: "https://api.example.com/pricing.json",
        checked_at: checkedAt,
      })
    }
    return result
  }
}
