/**
 * Ueepa —— 巴西注册商价目(BRL)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.ueepa.com.br/dominios/tabela-de-precos/
 * 表头: Extensão | Valor de Registro | Valor de Renovação | Valor de Transferência
 * 行:   .com.br | R$ 44,99 | R$ 44,99 / ano | R$ 44,99
 * 币种 BRL(巴西雷亚尔),BRL 币种注册商库内为 0, 本源填补空白。
 * 覆盖 .com.br/.net.br/.org.br/.art.br 等巴西 ccTLD + 通用 gTLD, 三价齐全。
 * TLD 单元格可能带备注(".com.br Este domínio exige CPF ou CNPJ."), 取前导 tld。
 * 限流(2026-10-11): 直连仅返回 11.9KB 无表格(JS 渲染/抽壳), 需 anti-bot 聚合
 *   反爬通道(FlareSolverr + Browserless 自动降级)拿完整价目表(227KB/394 行)。
 */
import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const URL = "https://www.ueepa.com.br/dominios/tabela-de-precos/"

/** 解析巴西格式价格 "R$ 44,99" / "44,99" / "R$ 44,99 / ano" → 44.99 */
function parseBRL(v: string): number | null {
  const t = v.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
  if (!t || t === "-" || t === "—") return null
  const m = t.match(/(\d{1,3}(?:[.,]\d{3})*[.,]\d{1,3}|\d+)/)
  if (!m) return null
  const raw = m[1]
  let norm: string
  // 巴西格式: "44,99" 或 "1.234,56"(点千分位,逗号小数)
  if (raw.includes(",") && raw.includes(".")) norm = raw.replace(/\./g, "").replace(",", ".")
  else if (raw.includes(",")) norm = raw.replace(",", ".")
  else norm = raw
  const n = Number.parseFloat(norm)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

function parseUeepa(raw: string): RawPrice[] {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const rows = raw.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of rows) {
    if (/<th[ >]/i.test(tr)) continue
    const cells = (tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []).map((c) =>
      c.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(),
    )
    if (cells.length < 4) continue
    const tldRaw = (cells[0] ?? "").trim().toLowerCase()
    const m = tldRaw.match(/^\.?([a-z0-9-]{2,20}(?:\.[a-z0-9-]{2,15}){0,2})\b/)
    if (!m) continue
    const tld = m[1]
    if (!/^[a-z0-9][a-z0-9.-]*$/.test(tld) || seen.has(tld)) continue
    const reg = parseBRL(cells[1] ?? "")
    const ren = parseBRL(cells[2] ?? "")
    const tra = parseBRL(cells[3] ?? "")
    if (reg == null && ren == null && tra == null) continue
    const price: RawPrice = { tld, currency: "BRL", sourceUrl: URL }
    if (reg != null) price.registerPrice = reg
    if (ren != null) price.renewPrice = ren
    if (tra != null) price.transferPrice = tra
    seen.add(tld)
    out.push(price)
  }
  if (out.length < 50) throw new Error(`ueepa 解析行数异常: ${out.length}(页面结构可能已变化)`)
  return out
}

export const ueepaAdapter = defineAdapter({
  slug: "ueepa",
  name: "Ueepa",
  website: "https://www.ueepa.com.br",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "BRL",
  priority: 50,
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["BRL"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 120_000 },
  strategies: [
    {
      type: "anti-bot",
      url: URL,
      antiBot: { keyword: "Transfer" },
      parse(raw: string): RawPrice[] {
        return parseUeepa(raw)
      },
    },
  ],
})