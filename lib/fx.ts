import { desc } from "drizzle-orm"
import { db } from "@/lib/db"
import { exchangeRates } from "@/lib/db/schema"

/**
 * 汇率模块 —— 接入 exchangerate-api.com,三层智能缓存:
 *   1. 进程内存缓存(5 分钟,避免同实例重复查库)
 *   2. 数据库缓存(按 API 声明的 next_update 时间过期,通常 24h)
 *   3. 过期拉取失败时回退旧值(stale-if-error),永不中断服务
 *
 * 有 EXCHANGERATE_API_KEY 时走 v6 正式端点,否则走免费开放端点。
 */

export type UsdRates = Record<string, number>

const MEMO_TTL_MS = 5 * 60 * 1000
let memo: { rates: UsdRates; at: number } | null = null

/** 展示币种白名单(右上角切换器可选项) */
export const DISPLAY_CURRENCIES = ["USD", "EUR", "GBP", "CNY", "JPY", "HKD", "SGD", "CAD", "AUD"] as const
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number]

/** 内置兜底汇率(API 与 DB 均不可用时的最后防线) */
const FALLBACK_RATES: UsdRates = {
  USD: 1, EUR: 0.88, GBP: 0.76, CNY: 6.78, JPY: 161.9, HKD: 7.8,
  SGD: 1.3, CAD: 1.37, AUD: 1.5, CHF: 0.89, SEK: 10.5, NOK: 10.7, NZD: 1.64,
}

async function fetchFromApi(): Promise<{ rates: UsdRates; nextUpdate: Date | null } | null> {
  const key = process.env.EXCHANGERATE_API_KEY
  const url = key
    ? `https://v6.exchangerate-api.com/v6/${key}/latest/USD`
    : "https://open.er-api.com/v6/latest/USD"
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), cache: "no-store" })
    if (!res.ok) return null
    const data = await res.json()
    // v6 正式端点字段为 conversion_rates,开放端点为 rates
    const rates: UsdRates | undefined = data.conversion_rates ?? data.rates
    if (!rates || (data.result && data.result !== "success")) return null
    const nextRaw: string | number | undefined = data.time_next_update_unix ?? data.time_next_update_utc
    const nextUpdate =
      typeof nextRaw === "number" ? new Date(nextRaw * 1000) : nextRaw ? new Date(nextRaw) : null
    return { rates, nextUpdate }
  } catch {
    return null
  }
}

/** 读取 USD 基准汇率表(1 USD = rates[X] 单位 X 货币) */
export async function getUsdRates(): Promise<UsdRates> {
  // 1. 内存缓存
  if (memo && Date.now() - memo.at < MEMO_TTL_MS) return memo.rates

  // 2. 数据库缓存
  let dbRow: typeof exchangeRates.$inferSelect | null = null
  try {
    const [row] = await db.select().from(exchangeRates).orderBy(desc(exchangeRates.fetchedAt)).limit(1)
    dbRow = row ?? null
  } catch {
    // 表不存在等场景,继续走 API
  }

  const now = Date.now()
  const dbFresh =
    dbRow &&
    (dbRow.nextUpdateAt
      ? now < new Date(dbRow.nextUpdateAt).getTime()
      : now - new Date(dbRow.fetchedAt).getTime() < 24 * 3600 * 1000)

  if (dbRow && dbFresh) {
    memo = { rates: dbRow.rates as UsdRates, at: now }
    return memo.rates
  }

  // 3. 过期 → 拉取 API
  const fetched = await fetchFromApi()
  if (fetched) {
    try {
      await db.insert(exchangeRates).values({
        base: "USD",
        rates: fetched.rates,
        nextUpdateAt: fetched.nextUpdate,
      })
    } catch {
      // 写库失败不影响返回
    }
    memo = { rates: fetched.rates, at: now }
    return fetched.rates
  }

  // 4. API 失败 → 回退旧值或内置兜底
  const stale = (dbRow?.rates as UsdRates | undefined) ?? FALLBACK_RATES
  memo = { rates: stale, at: now - MEMO_TTL_MS + 60 * 1000 } // 1 分钟后重试
  return stale
}

/** 任意币种金额 → USD */
export function toUsd(amount: number, from: string, rates: UsdRates): number {
  const r = rates[from]
  return r && r > 0 ? amount / r : amount
}

/** 任意币种金额 → 目标展示币种 */
export function convert(amount: number, from: string, to: string, rates: UsdRates): number {
  if (from === to) return amount
  const usd = toUsd(amount, from, rates)
  const rTo = rates[to]
  return rTo && rTo > 0 ? usd * rTo : usd
}
