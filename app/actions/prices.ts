"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { prices, priceHistory } from "@/lib/db/schema"
import { isAdminAuthenticated } from "@/lib/admin-auth"

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) throw new Error("未授权")
}

function parsePrice(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim()
  if (!s) return null
  const n = Number.parseFloat(s)
  if (Number.isNaN(n) || n < 0) throw new Error("价格必须为非负数字")
  return n.toFixed(2)
}

/**
 * 手动纠正某条价格。写入前先把旧值快照进 price_history，保证可追溯/可回滚。
 */
export async function updatePriceAction(priceId: number, formData: FormData) {
  await requireAdmin()
  const [current] = await db.select().from(prices).where(eq(prices.id, priceId)).limit(1)
  if (!current) throw new Error("价格记录不存在")

  // 旧值入历史
  await db.insert(priceHistory).values({
    registrarId: current.registrarId,
    tldId: current.tldId,
    registerPrice: current.registerPrice,
    renewPrice: current.renewPrice,
    transferPrice: current.transferPrice,
    currency: current.currency,
  })

  const registerPrice = parsePrice(formData.get("registerPrice"))
  const renewPrice = parsePrice(formData.get("renewPrice"))
  const transferPrice = parsePrice(formData.get("transferPrice"))
  const currency = String(formData.get("currency") ?? current.currency).trim().toUpperCase() || "USD"

  await db
    .update(prices)
    .set({ registerPrice, renewPrice, transferPrice, currency, updatedAt: new Date() })
    .where(eq(prices.id, priceId))

  revalidatePath("/admin/prices")
  revalidatePath("/", "layout")
}

/** 删除一条价格（同时留存历史快照） */
export async function deletePriceAction(priceId: number) {
  await requireAdmin()
  const [current] = await db.select().from(prices).where(eq(prices.id, priceId)).limit(1)
  if (!current) return
  await db.insert(priceHistory).values({
    registrarId: current.registrarId,
    tldId: current.tldId,
    registerPrice: current.registerPrice,
    renewPrice: current.renewPrice,
    transferPrice: current.transferPrice,
    currency: current.currency,
  })
  await db.delete(prices).where(eq(prices.id, priceId))
  revalidatePath("/admin/prices")
  revalidatePath("/", "layout")
}
