export function getActivePromotionPrice(
  price: string | null | undefined,
  promotionPrice: string | null | undefined,
  promotionEndsAt: Date | string | null | undefined,
) {
  if (price == null || promotionPrice == null) return null

  const baseAmount = Number(price)
  const promotionAmount = Number(promotionPrice)
  if (!Number.isFinite(baseAmount) || !Number.isFinite(promotionAmount) || promotionAmount <= 0 || promotionAmount >= baseAmount) {
    return null
  }

  if (promotionEndsAt != null) {
    const endTime = new Date(promotionEndsAt).getTime()
    if (!Number.isFinite(endTime) || endTime < Date.now()) return null
  }

  return promotionPrice
}

type PromoCodesRowLike = { code: string; promotionPrice?: number | null } | { code: string; promotionPrice?: number | null; promotionEndsAt?: string | null; sourceUrl?: string | null }

/** 取该行"后缀专属"优惠码: 优先带促销价的 TLD 专属码(去重); 无则回退主码单个。
 *  站级通用码不在具体后缀下重复展示。 */
export function getTldSpecificCodes(
  promoCodes: PromoCodesRowLike[] | null | undefined,
  promoCode: string | null | undefined,
): string[] {
  if (promoCodes && promoCodes.length > 0) {
    const tldSpecific = [
      ...new Set(
        promoCodes.filter((c) => c.promotionPrice != null && c.code).map((c) => c.code),
      ),
    ]
    if (tldSpecific.length > 0) return tldSpecific
  }
  return promoCode ? [promoCode] : []
}
