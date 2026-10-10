/**
 * OVHcloud —— 静态全价目表（注册 | 续费 | 转移，EUR）
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.ovhcloud.com/it/domains/tld/
 * 结构: <tr data-extension-name="com"
 *          data-installation-price="7.99" data-price="7.99"
 *          data-renew-price="13.49" data-transfer-price="7.99">
 *   901 TLD 全量（含 347 个多级后缀如 co.uk/com.au/org.hn 与波兰二级），
 *   每行完整注册+续费+转移价，纯静态 HTML 内嵌，无 JS 挑战。
 * 币种 EUR（意大利 locale，vat 含税显示）。国家 TLD 转移价可能为 0（合规限制，忽略）。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.ovhcloud.com/it/domains/tld/"

function parseOvh(raw: string, _ctx: AdapterContext): RawPrice[] {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const rows = raw.match(/data-extension-name="([^"]+)"\s+data-installation-price="([^"]+)"\s+data-price="[^"]+"\s+data-renew-price="([^"]+)"\s+data-transfer-price="([^"]+)"/gi) ?? []
  for (const row of rows) {
    const m = row.match(/data-extension-name="([^"]+)"\s+data-installation-price="([^"]+)"\s+data-price="[^"]+"\s+data-renew-price="([^"]+)"\s+data-transfer-price="([^"]+)"/i)
    if (!m) continue
    const tld = m[1].trim().toLowerCase()
    if (!tld || seen.has(tld)) continue
    const toNum = (v: string): number | null => {
      const n = Number.parseFloat(v)
      return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
    }
    const reg = toNum(m[2])
    const ren = toNum(m[3])
    const trf = toNum(m[4])
    if (reg == null && ren == null && trf == null) continue
    seen.add(tld)
    const price: RawPrice = { tld, currency: "EUR", sourceUrl: URL }
    if (reg != null) price.registerPrice = reg
    if (ren != null) price.renewPrice = ren
    if (trf != null) price.transferPrice = trf
    out.push(price)
  }
  if (out.length === 0) throw new Error("ovh 解析结果为空(页面结构可能已变化)")
  return out
}

export const ovhAdapter = defineAdapter({
  slug: "ovh",
  name: "OVHcloud",
  website: "https://www.ovhcloud.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "EUR",
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    supportedCurrencies: ["EUR"],
  },
  rateLimit: { concurrency: 1, rpm: 8, retries: 2, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      async fetch(ctx) {
        const res = await ctx.fetch(URL, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml",
          },
        })
        if (!res.ok) throw new Error(`ovh 价格页返回 HTTP ${res.status}`)
        return await res.text()
      },
      parse(raw, ctx) {
        return parseOvh(raw, ctx)
      },
    },
  ],
})
