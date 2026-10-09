/**
 * PS.kz 适配器
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 价格页 https://www.ps.kz/domains 为 JS 渲染表格（直连 109KB 无表格，
 * 渲染后 501KB 含 49 行）：[域名区, 注册价, 续费价]，哈萨克坚戈，
 * 值形如 "9 590 тг/жыл"（空格千分位），需自定义解析。
 * 通过 browser-worker 的 html 形态渲染后正则提取。
 */
import { defineAdapter } from "@/packages/adapter-sdk"

const PAGE_URL = "https://www.ps.kz/domains"

/** "9 590 тг/жыл" -> 9590；"27 600,50" -> 27600.5 */
function kztPrice(text: string): number | null {
  const m = text.match(/(\d[\d\s\u00a0]*\d|\d)(?:[.,](\d{1,2}))?/)
  if (!m) return null
  const v = parseFloat((m[1] + (m[2] ? "." + m[2] : "")).replace(/[\s\u00a0]/g, ""))
  return Number.isFinite(v) ? v : null
}

function cellText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export const pskzAdapter = defineAdapter({
  slug: "pskz",
  name: "PS.kz",
  website: "https://www.ps.kz",
  version: "1.0.0",
  parserVersion: "1.0.0",
  owner: "Data Team",
  currency: "KZT",
  capabilities: { registration: true, renewal: true, transfer: false, supportedCurrencies: ["KZT"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 3, timeoutMs: 120_000 },
  strategies: [
    {
      type: "playwright",
      url: PAGE_URL,
      async fetch(ctx) {
        const base = process.env.BROWSER_SERVICE_URL ?? "http://127.0.0.1:8840"
        const token = process.env.BROWSER_SERVICE_TOKEN ?? ""
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
        let html: string | null = null
        let lastErr = ""
        for (let attempt = 0; attempt < 3 && html === null; attempt++) {
          if (attempt > 0) await sleep(5_000)
          const res = await ctx.fetch(`${base}/render`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ url: PAGE_URL, extract: "html", scrollToBottom: true, waitForTimeoutMs: 12_000 }),
          })
          try {
            const data = (await res.json()) as { ok?: boolean; html?: string; error?: string }
            if (data.ok && data.html && /<tr/i.test(data.html)) html = data.html
            else lastErr = data.error ?? `HTTP ${res.status}（页面为空）`
          } catch {
            lastErr = `HTTP ${res.status}`
          }
        }
        if (html === null) throw new Error(lastErr || "浏览器渲染失败")
        return html
      },
      parse(raw): Array<{
        tld: string
        registerPrice: number | null
        renewPrice: number | null
        transferPrice: number | null
      }> {
        const html = raw
        const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
        const out: Array<{ tld: string; registerPrice: number | null; renewPrice: number | null; transferPrice: number | null }> = []
        for (const tr of rows) {
          const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => cellText(m[1]))
          if (cells.length < 3) continue
          const tld = (cells[0] ?? "").toLowerCase().replace(/^https?:\/\/\S*\//, "")
          if (!/^\.[a-z]/i.test(tld)) continue
          const registerPrice = kztPrice(cells[1] ?? "")
          const renewPrice = kztPrice(cells[2] ?? "")
          if (registerPrice === null && renewPrice === null) continue
          out.push({
            tld: tld.slice(1),
            registerPrice,
            renewPrice,
            transferPrice: null,
          })
        }
        return out
      },
    },
  ],
})
