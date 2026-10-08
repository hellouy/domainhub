"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Check, Copy, ExternalLink, Search, Tag, X } from "lucide-react"
import { TCount } from "@/components/i18n-text"
import { useCurrency, useLocale } from "@/components/providers"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { normalizeUrl, withRegistrarReferral } from "@/lib/utils"

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
  registrarWebsite: string | null
}

const DEALS_PAGE_SIZE = 48

export function DealsList({ deals }: { deals: Deal[] }) {
  const { money } = useCurrency()
  const { t, locale } = useLocale()
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [visibleCount, setVisibleCount] = useState(DEALS_PAGE_SIZE)
  const filteredDeals = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase().replace(/^\.+/, "")
    if (!normalizedQuery) return deals

    const exactSuffixMatches = deals.filter(
      (deal) => deal.tld.toLocaleLowerCase().replace(/^\.+/, "") === normalizedQuery,
    )
    if (exactSuffixMatches.length > 0) return exactSuffixMatches

    const suffixMatches = deals.filter((deal) =>
      deal.tld.toLocaleLowerCase().replace(/^\.+/, "").startsWith(normalizedQuery),
    )
    if (suffixMatches.length > 0) return suffixMatches

    return deals.filter((deal) =>
      [deal.registrarName, deal.registrar, deal.promoCode]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLocaleLowerCase().includes(normalizedQuery)),
    )
  }, [deals, query])
  const visibleDeals = filteredDeals.slice(0, visibleCount)

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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex min-w-0 items-center gap-2 border border-border bg-card px-3 py-2.5 focus-within:border-primary sm:max-w-md sm:flex-1">
          <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setVisibleCount(DEALS_PAGE_SIZE)
            }}
            placeholder={t("deals.search")}
            aria-label={t("deals.search")}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("")
                setVisibleCount(DEALS_PAGE_SIZE)
              }}
              aria-label={t("deals.clearSearch")}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          )}
        </label>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          <TCount k="deals.count" vars={{ n: filteredDeals.length }} />
        </p>
      </div>

      {filteredDeals.length === 0 ? (
        <p className="border border-dashed border-border bg-card px-5 py-12 text-center text-sm leading-relaxed text-muted-foreground">
          {t("deals.noResults")}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {visibleDeals.map((deal) => {
        const tld = deal.tld.toLocaleLowerCase().replace(/^\.+/, "")
        const original = deal.registerPrice ?? 0
        const offer = deal.promotionPrice ?? deal.registerPrice ?? 0
        const discount =
          deal.promotionPrice !== null && original > 0
            ? Math.round((1 - offer / original) * 100)
            : 0
        const copied = deal.promoCode !== null && copiedCode === deal.promoCode
        const endsAt = deal.promotionEndsAt
          ? new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            }).format(new Date(deal.promotionEndsAt))
          : null
        const sourceUrl = withRegistrarReferral(
          normalizeUrl(deal.sourceUrl, deal.registrarWebsite),
          "deals",
        )

        return (
          <li
            key={`${deal.registrar}-${tld}`}
            className="flex flex-col gap-4 border border-border bg-card p-4 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm active:scale-[0.99] motion-reduce:transition-none sm:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1.5">
                <Link
                  href={`/tld/${tld}`}
                  className="w-fit font-mono text-3xl font-bold leading-none tracking-tight text-foreground transition-colors hover:text-primary sm:text-4xl"
                >
                  .{tld}
                </Link>
                <Link
                  href={`/registrars/${deal.registrar}`}
                  className="truncate text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                >
                  {deal.registrarName}
                </Link>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {deal.promoCode ? t("deals.codeLabel") : t("promo.label")}
              </Badge>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3 border-y border-border py-3">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-2xl font-semibold tabular-nums text-primary">
                  {money(deal.promotionPrice ?? deal.registerPrice, deal.currency)}
                </span>
                {deal.promotionPrice !== null && deal.registerPrice !== null && (
                  <span className="text-xs text-muted-foreground">
                    <span className="sr-only">{t("deals.regularPrice")}: </span>
                    <span className="line-through">{money(deal.registerPrice, deal.currency)}</span>
                  </span>
                )}
                {deal.promoCode && deal.promotionPrice === null && (
                  <span className="text-xs leading-relaxed text-muted-foreground">{t("deals.codeOnlyPrice")}</span>
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
              <div className="flex flex-col items-start gap-1.5">
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t("outbound.attribution")}
                  className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  {t("deals.visit")}
                  <ExternalLink aria-hidden="true" className="size-4" />
                </a>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {t("outbound.attribution")}
                </span>
              </div>
            )}
          </li>
        )
      })}
        </ul>
      )}

      {visibleCount < filteredDeals.length && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setVisibleCount((count) => Math.min(count + DEALS_PAGE_SIZE, filteredDeals.length))}
          className="w-full sm:mx-auto sm:w-fit"
        >
          <TCount k="deals.loadMore" vars={{ n: filteredDeals.length - visibleCount }} />
        </Button>
      )}
    </div>
  )
}
