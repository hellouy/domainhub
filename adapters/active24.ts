/**
 * Active24（active24.cz）—— 捷克注册商价目(CZK)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.active24.cz/domeny/ (SSR 静态表)
 * 每行 5 列: [.tld, 首年(不含DPH, "首年 ... potom 续费"), 续费(不含DPH),
 *             首年(含DPH), 续费(含DPH)]
 * 取不含税(bez DPH)口径: 注册价=首年单元格首值, 续费价=第2列首值。
 * 例: .cz -> 169/359, .to -> 3499/3499, .com -> 299/419。币种 CZK。共 10 个后缀。
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.active24.cz/domeny/"

function firstCzk(s: string | undefined): number | null {
  if (!s) return null
  const m = s.match(/(\d[\d\s\u00a0]*)/)
  if (!m) return null
  const v = Number.parseInt(m[1].replace(/[\s\u00a0]/g, ""), 10)
  return Number.isFinite(v) && v > 0 ? v : null
}

export const active24Adapter = defineAdapter({
  slug: "active24",
  name: "Active24",
  website: "https://www.active24.cz",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "CZK",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["CZK"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse(raw: string): RawPrice[] {
        const trs = raw.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
        const out: RawPrice[] = []
        const seen = new Set<string>()
        for (const tr of trs) {
          const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
            m[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(),
          )
          if (cells.length < 4) continue
          const tld = cells[0].replace(/^\./, "").toLowerCase().trim()
          if (!tld || !/^[a-z0-9][a-z0-9.]*$/.test(tld) || seen.has(tld)) continue
          const reg = firstCzk(cells[1])
          const ren = firstCzk(cells[2])
          if (reg == null && ren == null) continue
          const p: RawPrice = { tld, currency: "CZK", sourceUrl: URL }
          if (reg != null) p.registerPrice = reg
          if (ren != null) p.renewPrice = ren
          seen.add(tld)
          out.push(p)
        }
        if (out.length < 5) throw new Error(`Active24 解析行数异常: ${out.length}(页面结构可能已变化)`)
        return out
      },
    },
  ],
})
