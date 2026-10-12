/**
 * Afriregister —— 非洲多国 ccTLD 注册商(欧元)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.afriregister.com/checkavailableforregister.php
 * 表: 141 行, 12 列 TLD | Min.Years | Register | Transfer | Renew | ...
 * 覆盖: .ss(南苏丹) .bi(布隆迪) .bf(布基纳法索) .bj(贝宁) .ml(马里) .ci(科特迪瓦)
 *        .cd(刚果) .sd(苏丹) .ne(尼日尔) .td(乍得) .tz(坦桑尼亚) .ke(肯尼亚)
 *        .ug(乌干达) .rw(卢旺达) .mz(莫桑比克) .mw(马拉维) .et(埃塞俄比亚)
 *        .bw(博茨瓦纳) .sn(塞内加尔) .so(索马里) .sl(塞拉利昂) 及 gTLD。
 * 价格 "€ 34.98"; Transfer=€ 0 表示免费转入。货币 EUR。
 * 注(2026-10-11): 该页 recaptcha 只用于提交表单, 价目表 DOM 直接返回可采。
 * 限流(2026-10-11): 源对匿名高频请求间歇限流(偶发返回空/截断响应导致解析 0 行)。
 *   新增 anti-bot 聚合通道降级策略(FlareSolverr + Browserless 自动降级)兜底,
 *   直连失败时自动改走聚合反爬服务, keyword=biz.ss 校验内容完整性。
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.afriregister.com/checkavailableforregister.php"

function parseEUR(v: string): number | null {
  const t = v.replace(/<[^>]+>/g, "")
  if (!t.trim()) return null
  if (t.includes("€")) {
    const n = Number.parseFloat(t.replace(/[^\d.]/g, ""))
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
  }
  if (/[0-9]/.test(t)) {
    const n = Number.parseFloat(t.replace(/[^\d.]/g, ""))
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
  }
  return null
}

/** 转移价允许 0(免费转入, 如 perso.ne/org.bf) */
function parseEURAllowZero(v: string): number | null {
  const t = v.replace(/<[^>]+>/g, "").trim()
  if (!t || t === "-") return null
  const m = t.replace(/[^\d.]/g, "")
  if (!m) return null
  const n = Number.parseFloat(m)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

/** 解析价目表 HTML → RawPrice[]（html 直连与 anti-bot 聚合通道共用） */
function parseAfriregister(raw: string): RawPrice[] {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const tbl = raw.match(/<table[\s\S]*?<\/table>/i)
  const scope = tbl ? tbl[0] : raw
  const rows = scope.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    if (/<th[ >]/i.test(tr)) continue
    const cells = tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []
    if (cells.length < 5) continue
    const tld = (cells[0] ?? "")
      .replace(/<[^>]+>/g, "")
      .replace(/[^a-z0-9.-]/gi, "")
      .trim()
      .toLowerCase()
      .replace(/^\./, "")
    if (!tld || !/^[a-z0-9][a-z0-9.-]*$/.test(tld) || seen.has(tld)) continue
    const reg = parseEUR(cells[2])
    const tra = parseEURAllowZero(cells[3])
    const ren = parseEUR(cells[4])
    if (reg == null && ren == null && tra == null) continue
    const price: RawPrice = { tld, currency: "EUR", sourceUrl: URL }
    if (reg != null) price.registerPrice = reg
    if (ren != null) price.renewPrice = ren
    if (tra != null) price.transferPrice = tra
    seen.add(tld)
    out.push(price)
  }
  if (out.length < 50) throw new Error(`Afriregister 解析行数异常: ${out.length}(页面结构可能已变化)`)
  return out
}

export const afriregisterAdapter = defineAdapter({
  slug: "afriregister",
  name: "Afriregister",
  website: "https://www.afriregister.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "EUR",
  priority: 50,
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["EUR"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: URL,
      fetch(ctx) {
        return ctx.fetch(URL, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml",
          },
        }).then(async (res) => {
          if (!res.ok) throw new Error(`Afriregister HTTP ${res.status}`)
          return await res.text()
        })
      },
      parse(raw: string): RawPrice[] {
        return parseAfriregister(raw)
      },
    },
    {
      type: "anti-bot",
      url: URL,
      antiBot: { keyword: "biz.ss" },
      parse(raw: string): RawPrice[] {
        return parseAfriregister(raw)
      },
    },
  ],
})