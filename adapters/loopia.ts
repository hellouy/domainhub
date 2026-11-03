/**
 * Loopia —— 统一入口网关 registrar 通道（约 47 个 TLD，SEK）
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: GET ${CRAWL_SERVICE_URL}/v1/registrar/prices?registrar=loopia
 *   （统一入口网关 43.133.72.184:8200，内部转发 Loopia 价格通道 :8000）
 * 认证: Authorization: Bearer <统一入口密钥>（CRAWL_SERVICE_TOKEN）
 * 响应: {ok, data:{rows:[{tld, register_price, renew_price, transfer_price, currency, updated_at}]}}
 * 2026-11-03: 直连 :8000 的旧 LOOPIA_API_KEY 已随凭证轮换失效(401 Invalid Token),
 *   切换到统一入口网关（网关自动携带内部通道密钥，外部调用方只需入口密钥）。
 */
import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const REGISTRAR = "loopia"
const DEFAULT_GATEWAY = "http://43.133.72.184:8200"

export const loopiaAdapter = defineAdapter({
  slug: REGISTRAR,
  name: "Loopia",
  website: "https://www.loopia.se",
  owner: "Data Team",
  version: "2.0.0",
  parserVersion: "2.0.0",
  currency: "SEK",
  capabilities: { registration: true, renewal: true, transfer: false, supportedCurrencies: ["SEK"] },
  rateLimit: { concurrency: 1, rpm: 30, retries: 2, timeoutMs: 30_000 },
  strategies: [
    {
      type: "api",
      url: `${DEFAULT_GATEWAY}/v1/registrar/prices?registrar=${REGISTRAR}`,
      async fetch(ctx: AdapterContext): Promise<string> {
        const base = process.env.CRAWL_SERVICE_URL ?? DEFAULT_GATEWAY
        const token = process.env.CRAWL_SERVICE_TOKEN ?? ""
        if (!token) throw new Error("loopia 适配器缺少 CRAWL_SERVICE_TOKEN（统一入口网关密钥）")
        const res = await ctx.fetch(`${base}/v1/registrar/prices?registrar=${REGISTRAR}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(`Loopia 网关通道 HTTP ${res.status}`)
        return res.text()
      },
      parse(raw: string): RawPrice[] {
        const parsed = JSON.parse(raw)
        if (!parsed?.ok || !Array.isArray(parsed.data?.rows)) {
          throw new Error(`Loopia 网关响应结构异常: ${raw.slice(0, 100)}`)
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
            sourceUrl: `${DEFAULT_GATEWAY}/v1/registrar/prices?registrar=${REGISTRAR}`,
          }
          if (price.registerPrice == null && price.renewPrice == null) continue
          out.push(price)
        }
        if (out.length === 0) throw new Error("Loopia 网关通道返回 0 行有效价格")
        return out
      },
    },
  ],
})
