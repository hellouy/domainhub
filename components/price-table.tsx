"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowUpDown, ExternalLink } from "lucide-react"
import { formatRelative } from "@/lib/format"
import { useCurrency, useLocale } from "@/components/providers"
import { PromotionPrice } from "@/components/promotion-price"
import { getActivePromotionPrice } from "@/lib/promotion"
import type { DictKey } from "@/lib/i18n"
import { cn, normalizeUrl, withRegistrarReferral } from "@/lib/utils"

export type PriceRow = {
  priceId: number
  registerPrice: string | null
  renewPrice: string | null
  transferPrice: string | null
  promotionPrice?: string | null
  promoCode?: string | null
  promotionEndsAt?: Date | string | null
  currency: string
  sourceUrl?: string | null
  updatedAt: Date | string
  registrarSlug: string
  registrarName: string
  registrarWebsite: string
}

type SortKey = "registerPrice" | "renewPrice" | "transferPrice"

function comparablePrice(row: PriceRow, key: SortKey) {
  return key === "registerPrice"
    ? getActivePromotionPrice(row.registerPrice, row.promotionPrice, row.promotionEndsAt) ?? row.registerPrice
    : row[key]
}

const SORT_LABEL_KEYS: Record<SortKey, DictKey> = {
  registerPrice: "pt.byRegister",
  renewPrice: "pt.byRenew",
  transferPrice: "pt.byTransfer",
}

function toNum(v: string | null) {
  if (v == null) return Number.POSITIVE_INFINITY
  const n = Number.parseFloat(v)
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n
}

/** 单元格 → USD 基准比较值。非促销占位价低于 $1 时不参与最低价竞争。 */
function toUsdAmount(v: string | null, currency: string, rates: Record<string, number>, allowSubDollar = false) {
  if (v == null) return Number.POSITIVE_INFINITY
  const n = Number.parseFloat(v)
  if (Number.isNaN(n)) return Number.POSITIVE_INFINITY
  const r = rates[currency]
  const usd = r && r > 0 ? n / r : n
  return usd >= 1 || allowSubDollar ? usd : Number.POSITIVE_INFINITY
}

function MobilePromoStrip({ row }: { row: PriceRow }) {
  const { money } = useCurrency()
  const { t, locale } = useLocale()
  const active = getActivePromotionPrice(row.registerPrice, row.promotionPrice, row.promotionEndsAt)
  if (active === null) return null

  const endDate = row.promotionEndsAt
    ? new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(new Date(row.promotionEndsAt))
    : null

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-primary/5 px-3 py-2 text-xs">
      <span className="font-medium text-primary">{t("promo.label")}</span>
      <span className="font-mono text-muted-foreground line-through tabular-nums">
        {money(row.registerPrice, row.currency)}
      </span>
      {row.promoCode && (
        <span className="inline-flex items-center gap-1 border border-dashed border-primary/50 px-1.5 py-0.5 font-mono font-semibold text-foreground">
          <span className="sr-only">{t("promo.code")}: </span>
          {row.promoCode}
        </span>
      )}
      {endDate && (
        <span className="ml-auto text-muted-foreground">
          {t("promo.ends")} {endDate}
        </span>
      )}
    </div>
  )
}

export function PriceTable({ rows, showUpdated = true }: { rows: PriceRow[]; showUpdated?: boolean }) {
  const { money, rates } = useCurrency()
  const { t, locale } = useLocale()
  const [sortKey, setSortKey] = useState<SortKey>("registerPrice")

  const sorted = useMemo(() => {
    const normalized = rates ?? {}
    return [...rows].sort(
      (a, b) =>
        toUsdAmount(
          comparablePrice(a, sortKey),
          a.currency,
          normalized,
          sortKey === "registerPrice" &&
            getActivePromotionPrice(a.registerPrice, a.promotionPrice, a.promotionEndsAt) !== null,
        ) -
        toUsdAmount(
          comparablePrice(b, sortKey),
          b.currency,
          normalized,
          sortKey === "registerPrice" &&
            getActivePromotionPrice(b.registerPrice, b.promotionPrice, b.promotionEndsAt) !== null,
        ),
    )
  }, [rows, sortKey, rates])

  const minValues = useMemo(() => {
    const keys: SortKey[] = ["registerPrice", "renewPrice", "transferPrice"]
    const mins: Partial<Record<SortKey, number>> = {}
    const normalized = rates ?? {}
    for (const key of keys) {
      const vals = rows
        .map((r) =>
          toUsdAmount(
            comparablePrice(r, key),
            r.currency,
            normalized,
            key === "registerPrice" &&
              getActivePromotionPrice(r.registerPrice, r.promotionPrice, r.promotionEndsAt) !== null,
          ),
        )
        .filter((v) => Number.isFinite(v))
      if (vals.length > 0) mins[key] = Math.min(...vals)
    }
    return mins
  }, [rows, rates])

  if (rows.length === 0) {
    return (
      <p className="border border-border bg-card p-8 text-center text-sm text-muted-foreground">{t("pt.empty")}</p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2" role="group" aria-label={t("pt.sortGroup")}>
        <ArrowUpDown aria-hidden="true" className="size-4 text-muted-foreground" />
        {(Object.keys(SORT_LABEL_KEYS) as SortKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSortKey(key)}
            aria-pressed={sortKey === key}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-colors",
              sortKey === key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent",
            )}
          >
            {t(SORT_LABEL_KEYS[key])}
          </button>
        ))}
      </div>
      <div className="divide-y divide-border border border-border md:hidden">
        {sorted.map((row) => {
          const visitUrl = withRegistrarReferral(
            normalizeUrl(row.sourceUrl, row.registrarWebsite),
            "price_table",
          )

          return (
            <article key={row.priceId} className="flex flex-col gap-3 p-3">
              <div className="flex items-center justify-between gap-3">
                <Link href={`/registrars/${row.registrarSlug}`} className="min-w-0 truncate font-semibold hover:text-primary">
                  {row.registrarName}
                </Link>
                <div className="flex shrink-0 items-center gap-3">
                  {showUpdated && <span className="text-xs text-muted-foreground">{formatRelative(row.updatedAt, locale)}</span>}
                  {visitUrl && (
                    <a
                      href={visitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t("pt.visitAria").replace("{name}", row.registrarName)}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center text-muted-foreground hover:text-primary"
                    >
                      <ExternalLink aria-hidden="true" className="size-4" />
                    </a>
                  )}
                </div>
              </div>
              <dl className="grid grid-cols-3 divide-x divide-border border-t border-border pt-3">
                {(["registerPrice", "renewPrice", "transferPrice"] as SortKey[]).map((key) => {
                  const value = comparablePrice(row, key)
                  const isMin =
                    toUsdAmount(
                      value,
                      row.currency,
                      rates ?? {},
                      key === "registerPrice" &&
                        getActivePromotionPrice(row.registerPrice, row.promotionPrice, row.promotionEndsAt) !== null,
                    ) === minValues[key]

                  return (
                    <div key={key} className="flex min-w-0 flex-col gap-1 px-3 first:pl-0 last:pr-0">
                      <dt className="text-xs text-muted-foreground">
                        {t(key === "registerPrice" ? "th.register" : key === "renewPrice" ? "th.renew" : "th.transfer")}
                      </dt>
                      <dd
                        className={cn(
                          "truncate font-mono text-sm tabular-nums",
                          value == null
                            ? "text-muted-foreground"
                            : isMin
                              ? "font-semibold text-primary"
                              : "text-foreground",
                        )}
                      >
                        {value == null ? "—" : money(value, row.currency)}
                        {isMin && <span className="sr-only">{t("pt.lowest")}</span>}
                      </dd>
                    </div>
                  )
                })}
              </dl>
              <MobilePromoStrip row={row} />
            </article>
          )
        })}
      </div>
      <div className="hidden overflow-x-auto border border-border md:block">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary text-left">
              <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {t("pt.registrar")}
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {t("th.register")}
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {t("th.renew")}
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {t("th.transfer")}
              </th>
              {showUpdated && (
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  {t("th.updated")}
                </th>
              )}
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                <span className="sr-only">{t("pt.visit")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.priceId} className="border-b border-border last:border-b-0 hover:bg-accent/50">
                <td className="px-4 py-3.5">
                  <Link href={`/registrars/${row.registrarSlug}`} className="font-medium hover:text-primary">
                    {row.registrarName}
                  </Link>
                </td>
                {(["registerPrice", "renewPrice", "transferPrice"] as SortKey[]).map((key) => {
                  const value = comparablePrice(row, key)
                  const isMin =
                    toUsdAmount(
                      value,
                      row.currency,
                      rates ?? {},
                      key === "registerPrice" &&
                        getActivePromotionPrice(row.registerPrice, row.promotionPrice, row.promotionEndsAt) !== null,
                    ) === minValues[key]
                  return (
                    <td
                      key={key}
                      className={cn(
                        "px-4 py-3.5 text-right font-mono tabular-nums",
                        isMin ? "font-semibold text-primary" : "text-foreground",
                      )}
                    >
                      {key === "registerPrice" ? (
                        <PromotionPrice
                          price={row.registerPrice}
                          promotionPrice={row.promotionPrice}
                          promoCode={row.promoCode}
                          promotionEndsAt={row.promotionEndsAt}
                          currency={row.currency}
                        />
                      ) : (
                        money(row[key], row.currency)
                      )}
                      {isMin && <span className="sr-only">{t("pt.lowest")}</span>}
                    </td>
                  )
                })}
                {showUpdated && (
                  <td className="px-4 py-3.5 text-right text-xs text-muted-foreground">
                    {formatRelative(row.updatedAt, locale)}
                  </td>
                )}
                <td className="px-4 py-3.5 text-right">
                  {withRegistrarReferral(
                    normalizeUrl(row.sourceUrl, row.registrarWebsite),
                    "price_table",
                  ) ? (
                    <a
                      href={withRegistrarReferral(
                        normalizeUrl(row.sourceUrl, row.registrarWebsite),
                        "price_table",
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t("pt.visitAria").replace("{name}", row.registrarName)}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center text-muted-foreground hover:text-primary"
                    >
                      <ExternalLink aria-hidden="true" className="size-4" />
                    </a>
                  ) : (
                    <ExternalLink aria-hidden="true" className="inline-flex size-4 text-muted-foreground/30" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
