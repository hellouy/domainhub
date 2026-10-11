/**
 * Hostripples —— 印度注册商价目(INR)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://hostripples.in/domain-registration.php
 * 表头: Extension | Category | Price (1st Year) | Renewal | Register
 * 行:   .comPopular | gTLD | ₹1,349 | ₹1,437 | Register
 * 币种 INR(印度卢比)。
 * 覆盖 24 个常见 gTLD/ccTLD(.com/.net/.org/.co.uk/.de 等)。
 * 两价结构: 注册(1st Year) + 续费(Renewal), 无转移价。
 * 解析要点:
 *   - TLD 单元格为 ".comPopular" 合并值, 剥离 "Popular" 后缀
 *   - 价格 INR 格式 "₹1,349" 逗号千分位
 * 限流(2026-10-11): 直连带浏览器 UA 323KB/24 行, 三列两价全齐。
 */
import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://hostripples.in/domain-registration.php"

/** 解析印度格式价格 "₹1,349" → 1349 */
function parseINR(v: string): number | null {
  const t = v.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
  if (!t || t === "-" || t === "—") return null
  const m = t.match(/₹\s?([\d,]+(?:\.\d{1,2})?)/)
  if (!m) return null
  const n = parseFloat(m[1].replace(/,/g, ""))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

function parseHostripples(raw: string): RawPrice[] {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const rows = raw.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    if (/scope=(?:"|')?col/i.test(tr)) continue
    const cells = (tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []).map((c) =>
      c.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(),
    )
    if (cells.length < 4) continue
    const tldRaw = (cells[0] ?? "").trim().split(/\s+/)[0] ?? ""
    const m = tldRaw.match(/^\.?([a-z0-9-]{2,20}(?:\.[a-z0-9-]{2,15}){0,2})$/)
    if (!m || seen.has(m[1])) continue
    const tld = m[1]
    const reg = parseINR(cells[2] ?? "")
    const ren = parseINR(cells[3] ?? "")
    if (reg == null || ren == null) continue
    const price: RawPrice = { tld, currency: "INR", sourceUrl: URL }
    price.registerPrice = reg
    price.renewPrice = ren
    seen.add(tld)
    out.push(price)
  }
  if (out.length < 10) throw new Error(`hostripples 解析行数异常: ${out.length}(页面结构可能已变化)`)
  return out
}

export const hostripplesAdapter = defineAdapter({
  slug: "hostripples",
  name: "Hostripples",
  website: "https://hostripples.in",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "INR",
  priority: 50,
  capabilities: { registration: true, renewal: true, transfer: false, supportedCurrencies: ["INR"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      fetch(ctx) {
        return ctx
          .fetch(URL, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
              Accept: "text/html,application/xhtml+xml",
            },
          })
          .then(async (res) => {
            if (!res.ok) throw new Error(`Hostripples HTTP ${res.status}`)
            return res.text()
          })
      },
      parse(raw: string): RawPrice[] {
        return parseHostripples(raw)
      },
    },
  ],
})