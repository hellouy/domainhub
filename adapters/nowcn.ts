/**
 * 时代互联（now.cn）— 价目页 SSR 内联 Vue 数据（约 175 个 TLD，CNY）
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.now.cn/domain/reg_price.php
 * 页面为 Vue 应用，价格数据以 `const tableData = [...]` 内联在 SSR HTML 中
 * （英文域名/中文域名/新顶级/国家/国际域名 tab 同页客户端过滤，全量数据一次性内联）。
 * 条目结构:
 *   { domainTpye: "domainEnglish;...",
 *     column1: { suffix, price(注册/首年), unit: "元 / 首年" },
 *     column2: { price(续费) }, column3: { price(转入) } }
 * 解析要点:
 *   - 单条 suffix 可用 "/" 捆绑多个后缀（如 .cn/.com.cn/.net.cn/... 同价），逐后缀展开
 *   - 同一后缀在中/英文 tab 有重复条目（中文 tab 价更高，如 .com 84 vs 280），
 *     按数组顺序首个优先（英文 tab 标准价排在前面）
 *   - 中文域名后缀为 unicode 明文（.中国/.公司/.网络/.网址 等），与库内 IDN 存储一致
 *   - 首年促销特征明显（.biz 10.5 首年 vs 159 续费），按挂牌价直映，不做促销猜测
 * 2026-11-03: 直连可采（无反爬），html 策略。
 */
import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

const PAGE_URL = "https://www.now.cn/domain/reg_price.php"

interface NowCnColumn {
  suffix?: string
  price?: number
  unit?: string
}
interface NowCnEntry {
  domainTpye?: string
  column1?: NowCnColumn
  column2?: NowCnColumn
  column3?: NowCnColumn
}

const toNum = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number.parseFloat(v) : NaN
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

/** 从 SSR HTML 提取内联 const tableData 数组（Vue 应用数据源） */
function extractTableData(html: string): NowCnEntry[] {
  const start = html.indexOf("const tableData = [")
  if (start === -1) throw new Error("now.cn 页面未找到 tableData 定义")
  const arrStart = html.indexOf("[", start)
  const vueIdx = html.indexOf("const app = new Vue")
  const bound = vueIdx === -1 ? html.length : vueIdx
  let snippet = html.slice(arrStart, bound)
  const lastBracket = snippet.lastIndexOf("]")
  if (lastBracket === -1) throw new Error("now.cn tableData 数组边界异常")
  snippet = snippet.slice(0, lastBracket + 1)
  const data = new Function(`return (${snippet})`)() as NowCnEntry[]
  if (!Array.isArray(data)) throw new Error("now.cn tableData 不是数组")
  return data
}

function parseNowcn(raw: string): RawPrice[] {
  const entries = extractTableData(raw)
  const out: RawPrice[] = []
  const seen = new Set<string>()
  for (const e of entries) {
    const suffix = e?.column1?.suffix
    if (!suffix) continue
    for (let s of suffix.split("/")) {
      s = s.trim().replace(/^\./, "").toLowerCase()
      if (!s || seen.has(s)) continue
      seen.add(s)
      const registerPrice = toNum(e.column1?.price)
      const renewPrice = toNum(e.column2?.price)
      const transferPrice = toNum(e.column3?.price)
      if (registerPrice == null && renewPrice == null && transferPrice == null) continue
      out.push({
        tld: s,
        currency: "CNY",
        registerPrice,
        renewPrice,
        transferPrice,
        sourceUrl: PAGE_URL,
      })
    }
  }
  if (out.length < 50) throw new Error(`now.cn 解析行数异常: ${out.length}（页面结构可能已变化）`)
  return out
}

export const nowcnAdapter = defineAdapter({
  slug: "nowcn",
  name: "时代互联",
  website: "https://www.now.cn",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "CNY",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["CNY"] },
  rateLimit: { concurrency: 1, rpm: 30, retries: 2, timeoutMs: 30_000 },
  strategies: [
    {
      type: "html",
      url: PAGE_URL,
      parse: parseNowcn,
    },
  ],
})
