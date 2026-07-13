/**
 * Storage Platform —— 价格持久化平台
 *
 * 所有权：Platform Team
 * 文档：docs/storage.md
 *
 * 只负责持久化：插入、更新、历史、差异对比、回滚。
 * 不包含任何注册商特定逻辑、不做校验（校验平台的职责）。
 * compare 语义：价格无变化的行跳过（不写 prices 也不写 history）。
 */

import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { priceHistory, prices, tlds } from "@/lib/db/schema"
import type { PriceSink } from "@/packages/adapter-sdk"
import type { ValidatedPrice } from "@/packages/adapter-sdk"

/** 归一化价格为 numeric 列字符串，便于比较 */
const norm = (v: number | null): string | null => (v === null ? v : v.toFixed(2))

export interface SaveStats {
  inserted: number
  updated: number
  skipped: number
  databaseMs: number
}

/**
 * 创建某注册商的 PriceSink（compare + save 的数据库实现）。
 * 预加载现有价格与 TLD 映射，避免循环查询。
 */
export async function createPriceSink(registrarId: number): Promise<{
  sink: PriceSink
  knownTlds: Set<string>
}> {
  const allTlds = await db.select().from(tlds)
  const tldIdMap = new Map(allTlds.map((t) => [t.tld, t.id]))
  const knownTlds = new Set(allTlds.map((t) => t.tld))

  const existing = await db.select().from(prices).where(eq(prices.registrarId, registrarId))
  const existingByTldId = new Map(existing.map((p) => [p.tldId, p]))
  const tldIdByName = tldIdMap

  const lookupExisting = (tld: string) => {
    const tldId = tldIdByName.get(tld)
    if (!tldId) return undefined
    const row = existingByTldId.get(tldId)
    if (!row) return undefined
    return {
      registerPrice: row.registerPrice ? Number.parseFloat(row.registerPrice) : null,
      renewPrice: row.renewPrice ? Number.parseFloat(row.renewPrice) : null,
    }
  }

  const save = async (validated: ValidatedPrice[]): Promise<SaveStats> => {
    const started = Date.now()
    let inserted = 0
    let updated = 0
    let skipped = 0

    for (const { price } of validated) {
      const tldId = tldIdMap.get(price.tld)
      if (!tldId) {
        // 未收录后缀：跳过（在 tlds 表添加后自动收录）
        continue
      }

      const next = {
        registerPrice: norm(price.registerPrice),
        renewPrice: norm(price.renewPrice),
        transferPrice: norm(price.transferPrice),
        currency: price.currency,
      }
      const prev = existingByTldId.get(tldId)

      // compare：价格与币种完全一致则跳过
      if (
        prev &&
        prev.registerPrice === next.registerPrice &&
        prev.renewPrice === next.renewPrice &&
        prev.transferPrice === next.transferPrice &&
        prev.currency === next.currency
      ) {
        skipped++
        continue
      }

      if (prev) {
        await db
          .update(prices)
          .set({ ...next, sourceUrl: price.sourceUrl, updatedAt: new Date() })
          .where(and(eq(prices.registrarId, registrarId), eq(prices.tldId, tldId)))
        updated++
      } else {
        await db.insert(prices).values({
          registrarId,
          tldId,
          ...next,
          sourceUrl: price.sourceUrl,
          updatedAt: new Date(),
        })
        inserted++
      }
      await db.insert(priceHistory).values({ registrarId, tldId, ...next })
    }

    return { inserted, updated, skipped, databaseMs: Date.now() - started }
  }

  return { sink: { lookupExisting, save }, knownTlds }
}

/**
 * 回滚：将某注册商某后缀的价格恢复到上一个历史版本。
 * 返回恢复到的历史行，无历史可回滚时返回 null。
 */
export async function rollbackPrice(
  registrarId: number,
  tldId: number,
): Promise<{ registerPrice: string | null; renewPrice: string | null } | null> {
  // 取最近两条历史：第一条是当前值，第二条是回滚目标
  const history = await db
    .select()
    .from(priceHistory)
    .where(and(eq(priceHistory.registrarId, registrarId), eq(priceHistory.tldId, tldId)))
    .orderBy(desc(priceHistory.id))
    .limit(2)

  if (history.length < 2) return null
  const target = history[1]

  await db
    .update(prices)
    .set({
      registerPrice: target.registerPrice,
      renewPrice: target.renewPrice,
      transferPrice: target.transferPrice,
      currency: target.currency,
      updatedAt: new Date(),
    })
    .where(and(eq(prices.registrarId, registrarId), eq(prices.tldId, tldId)))

  // 追加一条回滚历史（保持审计轨迹完整，不删除任何历史）
  await db.insert(priceHistory).values({
    registrarId,
    tldId,
    registerPrice: target.registerPrice,
    renewPrice: target.renewPrice,
    transferPrice: target.transferPrice,
    currency: target.currency,
  })

  return { registerPrice: target.registerPrice, renewPrice: target.renewPrice }
}
