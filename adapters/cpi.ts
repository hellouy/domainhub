/**
 * CPI（cpi.ad.jp）—— 日本 hosting/域名注册商(JPY)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.cpi.ad.jp/domain/ (SSR 静态表)
 * 表为"类别分组"结构(非逐 TLD): 每个类别行列出多个后缀 + 取得費用(注册),
 * 下一行是"更新費用(1年)"(续费)。例:
 *   ["gTLDドメイン （.com/.net/.org/.info/.biz）", "取得費用 （初回）", "6,600 円（税込）"]
 *   ["更新費用（1年）", "3,300 円（税込）"]
 * 解析: 从类别文本括号内的 ".a/.b" 拆出各后缀, 注册价取类别行末列, 续费价取下一行末列。
 * 币种 JPY(含税)。共 13 个后缀。
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.cpi.ad.jp/domain/"

function yen(s: string): number | null {
  const m = s.replace(/[^\d]/g, "")
  const v = Number.parseInt(m, 10)
  return Number.isFinite(v) && v > 0 ? v : null
}

export const cpiAdapter = defineAdapter({
  slug: "cpi",
  name: "CPI",
  website: "https://www.cpi.ad.jp",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "JPY",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["JPY"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse(raw: string): RawPrice[] {
        const trs = raw.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
        const rows = trs.map((tr) =>
          [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
            m[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(),
          ),
        )
        const out: RawPrice[] = []
        const byTld = new Map<string, RawPrice>()
        for (let i = 0; i < rows.length; i++) {
          const cells = rows[i]
          if (cells.length < 2) continue
          const body = cells.join(" ")
          const priceCell = cells[cells.length - 1]
          if (body.includes("取得費用")) {
            const tlds = (cells[0].match(/\.(?:[a-z]{2,}(?:\.[a-z]{2,})*)/gi) ?? []).map((t) =>
              t.toLowerCase().replace(/^\./, ""),
            )
            const reg = yen(priceCell)
            for (const tld of [...new Set(tlds)]) {
              const p: RawPrice = { tld, currency: "JPY", sourceUrl: URL }
              if (reg != null) p.registerPrice = reg
              byTld.set(tld, p)
            }
          } else if (body.includes("更新費用")) {
            const ren = yen(priceCell)
            if (ren != null) for (const p of byTld.values()) if (p.renewPrice == null) p.renewPrice = ren
          }
        }
        for (const p of byTld.values()) if (p.registerPrice != null) out.push(p)
        if (out.length < 4) throw new Error(`CPI 解析行数异常: ${out.length}(页面结构可能已变化)`)
        return out
      },
    },
  ],
})
