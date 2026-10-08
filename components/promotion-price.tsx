"use client"

import { Badge } from "@/components/ui/badge"
import { Money } from "@/components/money"
import { useLocale } from "@/components/providers"
import { getActivePromotionPrice } from "@/lib/promotion"

export function PromotionPrice({
  price,
  promotionPrice,
  promoCode,
  promotionEndsAt,
  currency,
}: {
  price: string | null
  promotionPrice?: string | null
  promoCode?: string | null
  promotionEndsAt?: Date | string | null
  currency: string
}) {
  const { t, locale } = useLocale()
  const activePrice = getActivePromotionPrice(price, promotionPrice, promotionEndsAt)

  if (activePrice === null) return <Money value={price} from={currency} />

  const endDate = promotionEndsAt
    ? new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(new Date(promotionEndsAt))
    : null

  return (
    <div className="flex flex-col items-end gap-1">
      <span className="font-semibold text-primary">
        <Money value={activePrice} from={currency} />
      </span>
      <span className="text-xs text-muted-foreground">
        <span className="line-through">
          <Money value={price} from={currency} />
        </span>
        <span className="sr-only"> {t("promo.label")}</span>
      </span>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <Badge variant="secondary">{t("promo.label")}</Badge>
        {promoCode && (
          <span className="text-xs text-muted-foreground">
            {t("promo.code")}: <span className="font-mono text-foreground">{promoCode}</span>
          </span>
        )}
      </div>
      {endDate && (
        <span className="text-xs text-muted-foreground">
          {t("promo.ends")}: {endDate}
        </span>
      )}
    </div>
  )
}

