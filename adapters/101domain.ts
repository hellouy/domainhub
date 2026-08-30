/**
 * 101domain 适配器
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 价格页为 div 网格布局（fetch 拿不到，浏览器可提取）：
 *   pricing.htm              —— 26 个主流 TLD 完整价（注册/续费/转入）；
 *                               注册价为促销价，清空只保留真实续费/转入价
 *   new_gtld_extensions.htm  —— 237 个新 gTLD 注册价（无续费/转入）
 * 通过 browser-worker 的 extract-json 形态逐页提取后合并。
 */
import { defineAdapter } from "@/packages/adapter-sdk"

const PRICING_URL = "https://www.101domain.com/pricing.htm"
const GTLD_URL = "https://www.101domain.com/new_gtld_extensions.htm"

export const domain101Adapter = defineAdapter({
  slug: "101domain",
  name: "101domain",
  website: "https://www.101domain.com",
  version: "1.0.0",
  parserVersion: "1.0.0",
  owner: "Data Team",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["USD"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 2, timeoutMs: 120_000 },
  strategies: [
    {
      type: "playwright",
      url: PRICING_URL,
      async fetch(ctx) {
        const base = process.env.BROWSER_SERVICE_URL ?? "http://127.0.0.1:8840"
        const out: unknown[] = []
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
        for (const u of [PRICING_URL, GTLD_URL]) {
          let extracted: unknown[] | null = null
          let lastErr = ""
          // 101domain 对连续浏览器请求限流（Cloudflare 间歇 502），加重试间隔
          for (let attempt = 0; attempt < 3 && extracted === null; attempt++) {
            if (attempt > 0) await sleep(2_500)
            const res = await ctx.fetch(`${base}/render`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({ url: u, extract: "extract-json", waitForTimeoutMs: 25_000 }),
            })
            try {
              const data = (await res.json()) as { ok?: boolean; extracted?: unknown[]; error?: string }
              if (data.ok && Array.isArray(data.extracted) && data.extracted.length > 0) extracted = data.extracted
              else lastErr = data.error ?? `HTTP ${res.status}（命中为空）`
            } catch {
              lastErr = `HTTP ${res.status}`
            }
          }
          if (extracted === null) throw new Error(lastErr || "浏览器渲染失败")
          out.push(...extracted)
          await sleep(2_500)
        }
        return JSON.stringify(out)
      },
      parse(raw): Array<{
        tld: string
        registerPrice: number | null
        renewPrice: number | null
        transferPrice: number | null
      }> {
        const rows = JSON.parse(raw) as Array<{
          tld?: string
          registerPrice?: number | null
          renewPrice?: number | null
          transferPrice?: number | null
        }>
        const out: Array<{ tld: string; registerPrice: number | null; renewPrice: number | null; transferPrice: number | null }> = []
        for (const r of rows) {
          if (!r.tld) continue
          // 主流表（有真实续费/转入价）里的登记价为促销，清空；新 gTLD 表仅注册价，保留
          if (r.renewPrice != null || r.transferPrice != null) {
            out.push({ tld: r.tld, registerPrice: null, renewPrice: r.renewPrice ?? null, transferPrice: r.transferPrice ?? null })
          } else {
            out.push({ tld: r.tld, registerPrice: r.registerPrice ?? null, renewPrice: null, transferPrice: null })
          }
        }
        return out
      },
    },
  ],
})