import type { CrawlContext, DomainPrice, RawContent } from "../types"
import type { RawRecord } from "@/services/parser"
import { BaseAdapter } from "./base.adapter"

/**
 * Dynadot 真实价格 Adapter
 *
 * 数据源优先级探测结论（2026-07）：
 * 1. 官方 API：Dynadot API v3 的 tld_price 命令需要账户 API Key，不可公开使用。
 * 2. JSON 端点：无独立公开端点。
 * 3. 结构化 HTML：dynadot.com/domain/prices 页面的 __NUXT_DATA__ 脚本标签
 *    内嵌完整定价数据（约 800+ 后缀，Nuxt/devalue 扁平数组格式，
 *    对象字段值为数组下标引用），服务端渲染直出、无需 Playwright。✓
 *
 * fetch() 负责取回 HTML 并拆出 __NUXT_DATA__ 的引用（信封拆解 + 引用解析），
 * 产出干净的 JSON 数组交给 Parser；解析与归一化仍走标准管线。
 */

const SOURCE_URL = "https://www.dynadot.com/domain/prices"

/** devalue 扁平数组中价格行对象的特征字段 */
interface DevalueRow {
  name: unknown
  reg_price: unknown
  renew_price: unknown
  tr_price?: unknown
}

function isDevalueRow(node: unknown): node is DevalueRow {
  return (
    node !== null &&
    typeof node === "object" &&
    !Array.isArray(node) &&
    "name" in node &&
    "reg_price" in node &&
    "renew_price" in node
  )
}

export class DynadotAdapter extends BaseAdapter {
  readonly slug = "dynadot"
  readonly name = "Dynadot"
  readonly strategy = "真实数据（官网定价页内嵌 __NUXT_DATA__）"

  protected async fetch(ctx: CrawlContext): Promise<RawContent> {
    const html = await this.httpGet(SOURCE_URL, ctx, "text/html")
    // 信封拆解：从 HTML 中取出 __NUXT_DATA__ 脚本内容（devalue 扁平数组）
    const match = html.match(
      /<script type="application\/json" data-nuxt-data="nuxt-app"[^>]*>([\s\S]*?)<\/script>/,
    )
    if (!match?.[1]) {
      throw new Error("页面结构变化：未找到 __NUXT_DATA__ 数据块")
    }
    let flat: unknown[]
    try {
      flat = JSON.parse(match[1])
    } catch {
      throw new Error("__NUXT_DATA__ 不是合法 JSON")
    }
    if (!Array.isArray(flat)) {
      throw new Error("__NUXT_DATA__ 结构异常：期望扁平数组")
    }

    // 引用解析：devalue 格式的字段值是数组下标，还原为普通对象数组
    const deref = (v: unknown): unknown =>
      typeof v === "number" && Number.isInteger(v) && v >= 0 && v < flat.length ? flat[v] : v

    const rows: Array<Record<string, unknown>> = []
    for (const node of flat) {
      if (!isDevalueRow(node)) continue
      rows.push({
        tld: deref(node.name),
        register: deref(node.reg_price),
        renew: deref(node.renew_price),
        transfer: deref(node.tr_price),
      })
    }
    if (rows.length === 0) {
      throw new Error("页面结构变化：__NUXT_DATA__ 中未找到任何价格行")
    }
    await ctx.log("info", `已从 __NUXT_DATA__ 还原 ${rows.length} 条价格引用`)
    return { kind: "json", body: JSON.stringify(rows), sourceUrl: SOURCE_URL }
  }

  protected normalize(records: RawRecord[], _ctx: CrawlContext): DomainPrice[] {
    const checkedAt = new Date()
    const result: DomainPrice[] = []
    for (const r of records) {
      const tld = this.toTld(r.tld)
      // 价格形如 "$10.88"，toPrice 会剥离货币符号；"--"/"-" 会归一化为 null
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
        currency: "USD",
        source: SOURCE_URL,
        checked_at: checkedAt,
      })
    }
    return result
  }
}

export const dynadotAdapter = new DynadotAdapter()
