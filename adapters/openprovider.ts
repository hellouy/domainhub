/**
 * OpenProvider 适配器
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 站点内部 XHR 端点 `/api/pricing-data?currency=USD` 返回全量
 * 2069 个 TLD 的注册/续费/转入/赎回价（USD，无凭证）。字段映射：
 * registerFee/renewalFee/transferFee/restoreFee → RawPrice 四价字段。
 */
import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

async function parseOpenprovider(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const { data } = JSON.parse(raw) as {
    data?: Array<Record<string, unknown>>
  }
  if (!Array.isArray(data)) return []
  const out: RawPrice[] = []
  for (const d of data) {
    const tld = String(d.tld ?? "").trim().toLowerCase()
    if (!tld) continue
    // 价格结构(2026-09 起)嵌套在 nonMember(公开零售) 与 member(会员) 下；
    // 公开比价取 nonMember，缺失时回退 member。
    const fee = (d.nonMember as Record<string, unknown>) ?? (d.member as Record<string, unknown>)
    if (!fee || typeof fee !== "object") continue
    const num = (v: unknown): number | null => {
      const n = Number(v)
      return Number.isFinite(n) && n > 0 ? n : null
    }
    out.push({
      tld,
      registerPrice: num(fee.registerFee),
      renewPrice: num(fee.renewalFee),
      transferPrice: num(fee.transferFee),
      restorePrice: num(fee.restoreFee),
      currency: String(d.currency ?? "USD"),
    })
  }
  return out
}

export const openproviderAdapter = defineAdapter({
  slug: "openprovider",
  name: "OpenProvider",
  website: "https://www.openprovider.com",
  version: "1.0.0",
  parserVersion: "1.0.0",
  owner: "Data Team",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["USD"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 2, timeoutMs: 60_000 },
  strategies: [
    {
      type: "api",
      url: "https://www.openprovider.com/api/pricing-data?currency=USD",
      parse: parseOpenprovider,
    },
  ],
})