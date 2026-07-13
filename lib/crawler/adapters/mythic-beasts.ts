import type { CrawlContext, DomainPrice, RawContent } from "../types"
import type { RawRecord } from "@/services/parser"
import { BaseAdapter } from "./base.adapter"

/**
 * Mythic Beasts 真实价格 Adapter
 *
 * 数据源优先级探测结论（2026-07）：
 * 1. 官方 API：Mythic Beasts 提供 DNS/Provisioning API，但无公开定价 API。
 * 2. JSON 端点：无。
 * 3. 结构化 HTML：mythic-beasts.com/domains 页面为服务端渲染的静态表格
 *    （600+ 后缀，GBP 计价，无反爬），列结构为
 *    Domain | 1 year | 2 years | 5 years | 10 years。✓
 *
 * 定价规则：Mythic Beasts 官方声明"续费与注册同价"（no renewal markup），
 * 因此 renew_price 取与 1 年注册价相同的值；转入价官网未列出，置 null。
 * 部分行（如 ac.uk）带 "Reg." 前缀单元格表示需人工注册，列数不同，按列数适配。
 */

const SOURCE_URL = "https://www.mythic-beasts.com/domains"

/** 从 "£6.00" / "&pound;6.00" 提取数字；"-" 等占位返回 null */
function parsePound(cell: string): number | null {
  const cleaned = cell.replace(/&pound;/g, "£").replace(/&nbsp;/g, " ").trim()
  const m = cleaned.match(/£\s*([0-9]+(?:\.[0-9]{1,2})?)/)
  if (!m) return null
  const n = Number.parseFloat(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

/** 去除 HTML 标签与实体，得到纯文本 */
function stripTags(cell: string): string {
  return cell
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim()
}

export class MythicBeastsAdapter extends BaseAdapter {
  readonly slug = "mythic-beasts"
  readonly name = "Mythic Beasts"
  readonly strategy = "真实数据（官网静态定价表，GBP，续费与注册同价）"

  protected async fetch(ctx: CrawlContext): Promise<RawContent> {
    const html = await this.httpGet(SOURCE_URL, ctx, "text/html")

    // 信封拆解：静态 <table> 行 -> JSON 行，解析细节不外溢到 normalize
    const trMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []
    if (trMatches.length < 50) {
      throw new Error(`页面结构变化：表格行过少（${trMatches.length}）`)
    }

    const rows: Array<{ tld: string; register: number | null }> = []
    let skippedSpecial = 0
    for (const tr of trMatches) {
      const cells = (tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/g) ?? []).map((c) =>
        c.replace(/^<t[dh][^>]*>/, "").replace(/<\/t[dh]>$/, ""),
      )
      if (cells.length < 2) continue
      const first = stripTags(cells[0]).toLowerCase()
      // 跳过表头与非后缀行
      if (!first || first === "domain" || /[^a-z0-9.-]/.test(first)) continue

      // 标准行：tld | 1yr | 2yr | 5yr | 10yr；特殊行（如 ac.uk）多一个 "Reg." 单元格
      let priceCell = cells[1]
      if (stripTags(cells[1]).toLowerCase().startsWith("reg")) {
        skippedSpecial++
        priceCell = cells[2] ?? ""
      }
      const register = parsePound(priceCell)
      if (register === null) continue
      rows.push({ tld: first, register })
    }

    if (rows.length === 0) {
      throw new Error("页面结构变化：未解析出任何价格行")
    }
    await ctx.log(
      "info",
      `已从静态表格解析 ${rows.length} 条价格（GBP），其中 ${skippedSpecial} 条特殊注册行按备用列取价`,
    )
    return { kind: "json", body: JSON.stringify(rows), sourceUrl: SOURCE_URL }
  }

  protected normalize(records: RawRecord[], _ctx: CrawlContext): DomainPrice[] {
    const checkedAt = new Date()
    const result: DomainPrice[] = []
    for (const r of records) {
      const tld = this.toTld(r.tld)
      const register = this.toPrice(r.register)
      if (!tld || register === null) continue
      result.push({
        registrar: this.slug,
        tld,
        register_price: register,
        // Mythic Beasts 官方定价规则：续费与注册同价
        renew_price: register,
        transfer_price: null,
        currency: "GBP",
        source: SOURCE_URL,
        checked_at: checkedAt,
      })
    }
    return result
  }
}

export const mythicBeastsAdapter = new MythicBeastsAdapter()
