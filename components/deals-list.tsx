"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, Copy, ExternalLink, Tag } from "lucide-react"
import { useCurrency, useLocale } from "@/components/providers"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { normalizeUrl } from "@/lib/utils"

type Deal = {
  registrar: string
  registrarName: string
  tld: string
  currency: string
  registerPrice: number | null
  promotionPrice: number | null
  promoCode: string | null
  promotionEndsAt: Date | string | null
  sourceUrl: string | null
}

export function DealsList({ deals }: { deals: Deal[] }) {
  const { money } = useCurrency()
  const { t, locale } = useLocale()
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      window.setTimeout(() => setCopiedCode(null), 1800)
    } catch {
      setCopiedCode(null)
    }
  }

  if (deals.length === 0) {
    return (
      <p className="border border-dashed border-border bg-card px-5 py-12 text-center text-sm leading-relaxed text-muted-foreground">
        {t("deals.empty")}
      </p>
    )
  }

  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {deals.map((deal) => {
        const original = deal.registerPrice ?? 0
        const offer = deal.promotionPrice ?? 0
        const discount = original > 0 ? Math.round((1 - offer / original) * 100) : 0
        const copied = deal.promoCode !== null && copiedCode === deal.promoCode
        const endsAt = deal.promotionEndsAt
          ? new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            }).format(new Date(deal.promotionEndsAt))
          : null
        const sourceUrl = normalizeUrl(deal.sourceUrl)

        return (
          <li key={`${deal.registrar}-${deal.tld}`} className="flex flex-col gap-4 border border-border bg-card p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <Link href={`/registrars/${deal.registrar}`} className="truncate font-semibold hover:text-primary">
                  {deal.registrarName}
                </Link>
                <Link href={`/tld/${deal.tld}`} className="font-mono text-sm text-muted-foreground hover:text-primary">
                  .{deal.tld}
                </Link>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {deal.promoCode ? t("deals.codeLabel") : t("promo.label")}
              </Badge>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3 border-y border-border py-3">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-2xl font-semibold tabular-nums text-primary">
                  {money(deal.promotionPrice, deal.currency)}
                </span>
                {deal.registerPrice !== null && (
                  <span className="text-xs text-muted-foreground">
                    <span className="sr-only">{t("deals.regularPrice")}: </span>
                    <span className="line-through">{money(deal.registerPrice, deal.currency)}</span>
                  </span>
                )}
              </div>
              {discount > 0 && <span className="text-sm font-medium text-muted-foreground">−{discount}%</span>}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                {deal.promoCode ? (
                  <>
                    <Tag aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                    <code className="break-all rounded-md border border-dashed border-border bg-muted px-2.5 py-1.5 font-mono text-sm font-semibold text-foreground">
                      {deal.promoCode}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={copied ? t("deals.copied") : t("deals.copyCode")}
                      title={copied ? t("deals.copied") : t("deals.copyCode")}
                      onClick={() => void copyCode(deal.promoCode!)}
                    >
                      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                    </Button>
                    <span className="sr-only" aria-live="polite">{copied ? t("deals.copied") : ""}</span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">{t("promo.label")}</span>
                )}
              </div>
              {endsAt && (
                <span className="text-xs text-muted-foreground">
                  {t("deals.ends")} {endsAt}
                </span>
              )}
            </div>

            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                {t("deals.visit")}
                <ExternalLink aria-hidden="true" className="size-4" />
              </a>
            )}
          </li>
        )
      })}
    </ul>
  )
}
