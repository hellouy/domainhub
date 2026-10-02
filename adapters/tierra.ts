/**
 * Tierra Registry —— 公开 JSON 价目 API（约 359 TLD）
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://registry.tierra.net:8443/pricingData
 * 返回 JSON: { tld: [register, renew, transfer, sale/, type] }
 * 数组第 4 项是 sale 溢价注册价（demand/special），第三项是 transfer。
 * 已验证 2026-09-29：.com 与 AI/TLD 价均为 target/retail 零售价页同源。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

async function parseTierra(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const data: Record<string, string[]> = JSON.parse(raw)
  const out: RawPrice[] = []
  const seen = new Set<string>()
  for (const [tld, arr] of Object.entries(data)) {
    const t = tld.trim().toLowerCase().replace(/^\./, "")
    if (!t || seen.has(t)) continue
    if (!Array.isArray(arr) || arr.length < 3) continue
    const toNum = (v: string | undefined): number | null => {
      if (v == null) return null
      const n = Number.parseFloat(String(v).replace(/[^\d.]/g, ""))
      return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
    }
    const registerPrice = toNum(arr[0])
    const renewPrice = toNum(arr[1])
    const transferPrice = toNum(arr[2])
    // 第 4 项若为明确溢价注册价（不同于前三位）可作为 premium sale 参考；
    // 但为避免与常规 register 冲突，仅当无明显常规价时采用。
    if (registerPrice == null && renewPrice == null && transferPrice == null) continue
    seen.add(t)
    out.push({
      tld: t,
      currency: "USD",
      registerPrice,
      renewPrice,
      transferPrice,
      sourceUrl: "https://registry.tierra.net:8443/pricingData",
    })
  }
  if (out.length === 0) throw new Error("tierra pricingData 解析结果为空（结构可能已变化）")
  return out
}

export const tierraAdapter = defineAdapter({
  slug: "tierra",
  name: "Tierra",
  website: "https://tierra.net",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["USD"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 2, timeoutMs: 60_000 },
  strategies: [
    {
      type: "json",
      url: "https://registry.tierra.net:8443/pricingData",
      parse: parseTierra,
    },
  ],
})