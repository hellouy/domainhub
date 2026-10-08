export function getActivePromotionPrice(
  price: string | null | undefined,
  promotionPrice: string | null | undefined,
  promotionEndsAt: Date | string | null | undefined,
) {
  if (price == null || promotionPrice == null) return null

  const baseAmount = Number(price)
  const promotionAmount = Number(promotionPrice)
  if (!Number.isFinite(baseAmount) || !Number.isFinite(promotionAmount) || promotionAmount < 0 || promotionAmount >= baseAmount) {
    return null
  }

  if (promotionEndsAt != null) {
    const endTime = new Date(promotionEndsAt).getTime()
    if (!Number.isFinite(endTime) || endTime < Date.now()) return null
  }

  return promotionPrice
}
