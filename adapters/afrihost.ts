/**
 * Afrihost —— 南非本地注册商, 静态价目表(ZAR)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.afrihost.com/domains
 * 结构: <dt>.tld</dt><dd><span class="formatted-price"> R197.<span>00 </span></span>
 *       (价格小数位被 <span> 拆分, 需拼接)
 * 已验证 ~101 TLD, 注册价 ZAR/年 (卡片仅显示注册价; 页面 JSON 含三价但字段顺序有歧义, 不采)
 * 特色: .africa/.durban/.joburg/.co.za/.mu 等非洲 ccTLD 与南非本地域名
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.afrihost.com/domains"

async function parseAfrihost(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const priceRe = /<dt>\s*\.([a-z0-9][a-z0-9.-]{1,23})\s*<\/dt>\s*<dd>.*?formatted-price">\s*(?:R\s*)?(\d{2,4})\.<span>(\d{2})/gi
  let m: RegExpExecArray | null
  while ((m = priceRe.exec(raw))) {
    const tld = m[1].toLowerCase().replace(/^\./, "")
    if (!tld || seen.has(tld)) continue
    seen.add(tld)
    const amount = Number.parseFloat(`${m[2]}.${m[3]}`)
    if (!Number.isFinite(amount) || amount <= 0) continue
    out.push({ tld, currency: "ZAR", registerPrice: Math.round(amount * 100) / 100, sourceUrl: URL })
  }
  if (out.length === 0) throw new Error("afrihost 解析结果为空(页面结构可能已变化)")
  return out
}

export const afrihostAdapter = defineAdapter({
  slug: "afrihost",
  name: "Afrihost",
  website: "https://www.afrihost.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "ZAR",
  capabilities: { registration: true, supportedCurrencies: ["ZAR"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      parse: parseAfrihost,
    },
  ],
})
