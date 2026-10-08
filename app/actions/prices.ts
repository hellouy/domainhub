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
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0) throw new Error("价格必须为非负数字")
  return n.toFixed(2)
}

function parsePromotionEnd(v: FormDataEntryValue | null): Date | null {
  const value = String(v ?? "").trim()
  if (!value) return null
  const date = new Date(`${value}T23:59:59.999Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("优惠截止日期无效")
  }
  return date
}

/**
 * 手动纠正某条价格。写入前先把旧值快照进 price_history，保证可追溯/可回滚。
 */
export async function updatePriceAction(priceId: number, formData: FormData) {
  await requireAdmin()
  const [current] = await db.select().from(prices).where(eq(prices.id, priceId)).limit(1)
  if (!current) throw new Error("价格记录不存在")

  const registerPrice = parsePrice(formData.get("registerPrice"))
  const renewPrice = parsePrice(formData.get("renewPrice"))
  const transferPrice = parsePrice(formData.get("transferPrice"))
  const promotionPrice = parsePrice(formData.get("promotionPrice"))
  const promoCode = String(formData.get("promoCode") ?? "").trim() || null
  if (promoCode && promoCode.length > 120) throw new Error("优惠码不能超过 120 个字符")
  if (promoCode && promotionPrice === null) throw new Error("录入优惠码时请同时填写优惠价")
  if (promotionPrice !== null && (registerPrice === null || Number(promotionPrice) >= Number(registerPrice))) {
    throw new Error("优惠价必须低于注册价")
  }
  const promotionEndsAt = parsePromotionEnd(formData.get("promotionEndsAt"))
  const currency = String(formData.get("currency") ?? current.currency).trim().toUpperCase() || "USD"
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("请输入有效的三位货币代码")

  // 旧值入历史，包含促销价、优惠码和截止日期，便于完整追溯。
  await db.insert(priceHistory).values({
    registrarId: current.registrarId,
    tldId: current.tldId,
    registerPrice: current.registerPrice,
    renewPrice: current.renewPrice,
    transferPrice: current.transferPrice,
    currency: current.currency,
    promotionPrice: current.promotionPrice,
    promoCode: current.promoCode,
    promotionEndsAt: current.promotionEndsAt,
  })

  await db
    .update(prices)
    .set({ registerPrice, renewPrice, transferPrice, promotionPrice, promoCode, promotionEndsAt, currency, updatedAt: new Date() })
    .where(eq(prices.id, priceId))

  revalidatePath("/admin/prices")
  revalidatePath("/deals")
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
    promotionPrice: current.promotionPrice,
    promoCode: current.promoCode,
    promotionEndsAt: current.promotionEndsAt,
  })
  await db.delete(prices).where(eq(prices.id, priceId))
  revalidatePath("/admin/prices")
  revalidatePath("/", "layout")
}
