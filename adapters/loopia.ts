/**
 * Loopia — 直接价格 API（约 47 个 TLD，SEK）
 * ------------------------------------------------------------
 * 源: http://43.133.72.184:8000/v1/prices?registrar=loopia
 * 认证: Authorization: Bearer <token>
 */
import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const API_BASE = "http://43.133.72.184:8000"
const REGISTRAR = "loopia"
const API_KEY = process.env.LOOPIA_API_KEY ?? ""

export const loopiaAdapter = defineAdapter({
  slug: REGISTRAR,
  name: "Loopia",
  website: "https://www.loopia.se",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "SEK",
  capabilities: { registration: true, renewal: true, transfer: false, supportedCurrencies: ["SEK"] },
  rateLimit: { concurrency: 1, rpm: 30, retries: 2, timeoutMs: 30_000 },
  strategies: [
    {
      type: "json",
      url: `${API_BASE}/v1/prices?registrar=${REGISTRAR}`,
      async fetch(ctx: AdapterContext): Promise<string> {
        if (!API_KEY) throw new Error("LOOPIA_API_KEY is not configured")
        const res = await ctx.fetch(`${API_BASE}/v1/prices?registrar=${REGISTRAR}`, {
          headers: { Authorization: `Bearer ${API_KEY}` },
        })
        if (!res.ok) throw new Error(`Loopia API HTTP ${res.status}`)
        return res.text()
      },
      parse(raw: string): RawPrice[] {
        const parsed = JSON.parse(raw)
        if (!parsed?.ok || !Array.isArray(parsed.data?.rows)) {
          throw new Error(`Loopia API unexpected response: ${raw.slice(0, 100)}`)
        }
        const out: RawPrice[] = []
        for (const row of parsed.data.rows) {
          if (!row.tld || row.register_price == null) continue
          const toNum = (v: unknown): number | null =>
            typeof v === "number" && v > 0 ? Math.round(v * 100) / 100 : null
          const price: RawPrice = {
            tld: String(row.tld).replace(/^\./, "").toLowerCase(),
            currency: "SEK",
            registerPrice: toNum(row.register_price),
            renewPrice: toNum(row.renew_price) ?? null,
            sourceUrl: `${API_BASE}/v1/prices?registrar=${REGISTRAR}`,
          }
          if (price.registerPrice == null && price.renewPrice == null) continue
          out.push(price)
        }
        if (out.length === 0) throw new Error("Loopia API returned no valid price rows")
        return out
      },
    },
  ],
})
