/**
 * INWX 适配器（德国最大独立注册商）
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 公开内部 JSON API `/api/v1/domain/all-prices` 返回全量 2232 个 TLD 的
 * 注册/续费/转入/赎回价（无凭证，主 USD / 个别 EUR）。字段映射：
 * createPrice/renewalPrice/transferPrice/restorePrice → RawPrice 四价字段。
 */
import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

async function parseInwx(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const { tlds } = JSON.parse(raw) as { tlds?: Array<Record<string, unknown>> }
  if (!Array.isArray(tlds)) return []
  const out: RawPrice[] = []
  for (const t of tlds) {
    const tld = String(t.tld ?? "").trim().toLowerCase()
    if (!tld) continue
    const num = (v: unknown): number | null => {
      const n = Number(v)
      return Number.isFinite(n) && n > 0 ? n : null
    }
    out.push({
      tld,
      registerPrice: num(t.createPrice),
      renewPrice: num(t.renewalPrice),
      transferPrice: num(t.transferPrice),
      restorePrice: num(t.restorePrice),
      currency: String(t.currency ?? "USD"),
    })
  }
  return out
}

export const inwxAdapter = defineAdapter({
  slug: "inwx",
  name: "INWX",
  website: "https://www.inwx.com",
  version: "1.0.0",
  parserVersion: "1.0.0",
  owner: "Data Team",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["USD", "EUR"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 2, timeoutMs: 60_000 },
  strategies: [
    {
      type: "api",
      url: "https://www.inwx.com/api/v1/domain/all-prices",
      parse: parseInwx,
    },
  ],
})