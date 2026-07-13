import "server-only"

import { db } from "@/lib/db"
import { exchangeRates } from "@/lib/db/schema"
import { cacheService } from "@/services/cache"
import { sql } from "drizzle-orm"

/**
 * 汇率服务（ExchangeRate-API）
 *
 * 职责：
 * - 从 ExchangeRate-API 拉取 USD 基准汇率并缓存到 exchange_rates 表
 * - 汇率有效期 24 小时，过期后自动刷新（免费额度 1500 次/月，绰绰有余）
 * - 提供 toUSD 换算：任何币种价格 → USD，供前台统一比价
 * - API 不可用时回退到数据库中最近一次汇率（永不阻塞比价功能）
 */

const API_BASE = "https://v6.exchangerate-api.com/v6"
/** 汇率视为新鲜的时长：24 小时 */
const FRESH_MS = 24 * 60 * 60 * 1000
/** 进程内缓存 key */
const CACHE_KEY = "currency:rates"

export interface RateMap {
  /** 币种 → 1 USD 兑该币种的数量（例：EUR 0.87） */
  [currency: string]: number
}

export class CurrencyService {
  /**
   * 获取汇率表（USD 基准）。
   * 优先级：进程内缓存（1h）→ 数据库（24h 内新鲜）→ ExchangeRate-API → 数据库陈旧数据兜底
   */
  async getRates(): Promise<RateMap> {
    return cacheService.getOrSet<RateMap>(
      CACHE_KEY,
      60 * 60 * 1000,
      async () => {
        const rows = await db.select().from(exchangeRates)
        const newest = rows.reduce<Date | null>(
          (acc, r) => (acc === null || r.fetchedAt > acc ? r.fetchedAt : acc),
          null,
        )
        const isFresh = newest !== null && Date.now() - newest.getTime() < FRESH_MS

        if (isFresh && rows.length > 0) {
          return this.rowsToMap(rows)
        }

        // 需要刷新：调用 ExchangeRate-API
        try {
          const fresh = await this.fetchFromApi()
          await this.persist(fresh)
          return fresh
        } catch (error) {
          console.log("[v0] 汇率 API 拉取失败，使用数据库兜底:", error instanceof Error ? error.message : error)
          if (rows.length > 0) return this.rowsToMap(rows)
          // 完全没有汇率数据：返回仅含 USD 的表（比价时非 USD 币种原样展示）
          return { USD: 1 }
        }
      },
      ["currency"],
    )
  }

  /** 将某币种的金额换算为 USD。未知币种返回 null（调用方决定如何展示）。 */
  async toUSD(amount: number, currency: string): Promise<number | null> {
    if (!Number.isFinite(amount)) return null
    const cur = currency.toUpperCase()
    if (cur === "USD") return amount
    const rates = await this.getRates()
    const rate = rates[cur]
    if (!rate || rate <= 0) return null
    return amount / rate
  }

  /** 批量换算辅助：返回一个同步换算函数（先取一次汇率表，避免循环内重复 await） */
  async getConverter(): Promise<(amount: number | string | null, currency: string) => number | null> {
    const rates = await this.getRates()
    return (amount, currency) => {
      if (amount === null) return null
      const num = typeof amount === "string" ? Number.parseFloat(amount) : amount
      if (!Number.isFinite(num)) return null
      const cur = currency.toUpperCase()
      if (cur === "USD") return num
      const rate = rates[cur]
      if (!rate || rate <= 0) return null
      return num / rate
    }
  }

  /** 汇率元信息：最近拉取时间与币种数（监控页展示用） */
  async getMeta(): Promise<{ fetchedAt: Date | null; count: number }> {
    const rows = await db.select().from(exchangeRates)
    const newest = rows.reduce<Date | null>(
      (acc, r) => (acc === null || r.fetchedAt > acc ? r.fetchedAt : acc),
      null,
    )
    return { fetchedAt: newest, count: rows.length }
  }

  private rowsToMap(rows: { currency: string; rateToUsd: string }[]): RateMap {
    const map: RateMap = { USD: 1 }
    for (const row of rows) {
      const rate = Number.parseFloat(row.rateToUsd)
      if (Number.isFinite(rate) && rate > 0) map[row.currency] = rate
    }
    return map
  }

  private async fetchFromApi(): Promise<RateMap> {
    const key = process.env.EXCHANGERATE_API_KEY
    if (!key) throw new Error("EXCHANGERATE_API_KEY 未设置")
    const res = await fetch(`${API_BASE}/${key}/latest/USD`, {
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`汇率 API HTTP ${res.status}`)
    const data = (await res.json()) as {
      result?: string
      conversion_rates?: Record<string, number>
    }
    if (data.result !== "success" || !data.conversion_rates) {
      throw new Error(`汇率 API 返回异常：${data.result ?? "未知"}`)
    }
    return { USD: 1, ...data.conversion_rates }
  }

  private async persist(rates: RateMap): Promise<void> {
    const now = new Date()
    const values = Object.entries(rates)
      .filter(([, rate]) => Number.isFinite(rate) && rate > 0)
      .map(([currency, rate]) => ({
        currency,
        rateToUsd: rate.toFixed(8),
        fetchedAt: now,
      }))
    if (values.length === 0) return
    // 批量 upsert（166 币种一次写入）
    await db
      .insert(exchangeRates)
      .values(values)
      .onConflictDoUpdate({
        target: exchangeRates.currency,
        set: {
          rateToUsd: sql`excluded.rate_to_usd`,
          fetchedAt: sql`excluded.fetched_at`,
        },
      })
  }
}

export const currencyService = new CurrencyService()
