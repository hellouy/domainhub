"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowUpDown, ExternalLink } from "lucide-react"
import { formatRelative } from "@/lib/format"
import { useCurrency, useLocale } from "@/components/providers"
import type { DictKey } from "@/lib/i18n"
import { cn, normalizeUrl } from "@/lib/utils"

export type PriceRow = {
  priceId: number
  registerPrice: string | null
  renewPrice: string | null
  transferPrice: string | null
  currency: string
  sourceUrl?: string | null
  updatedAt: Date | string
  registrarSlug: string
  registrarName: string
  registrarWebsite: string
}

type SortKey = "registerPrice" | "renewPrice" | "transferPrice"

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

/** 单元格 → USD 基准比较值。非空且折算后 >= $1 才参与"最低价"竞争,排除促销占位价。 */
function toUsdAmount(v: string | null, currency: string, rates: Record<string, number>) {
  if (v == null) return Number.POSITIVE_INFINITY
  const n = Number.parseFloat(v)
  if (Number.isNaN(n)) return Number.POSITIVE_INFINITY
  const r = rates[currency]
  const usd = r && r > 0 ? n / r : n
  return usd >= 1 ? usd : Number.POSITIVE_INFINITY
}

export function PriceTable({ rows, showUpdated = true }: { rows: PriceRow[]; showUpdated?: boolean }) {
  const { money, rates } = useCurrency()
  const { t, locale } = useLocale()
  const [sortKey, setSortKey] = useState<SortKey>("registerPrice")

  const sorted = useMemo(() => {
    const normalized = rates ?? {}
    return [...rows].sort((a, b) => toUsdAmount(a[sortKey] as string, a.currency, normalized) - toUsdAmount(b[sortKey] as string, b.currency, normalized))
  }, [rows, sortKey, rates])

  const minValues = useMemo(() => {
    const keys: SortKey[] = ["registerPrice", "renewPrice", "transferPrice"]
    const mins: Partial<Record<SortKey, number>> = {}
    const normalized = rates ?? {}
    for (const key of keys) {
      const vals = rows.map((r) => toUsdAmount(r[key] as string, r.currency, normalized)).filter((v) =>
        Number.isFinite(v),
      )
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
      <div className="overflow-x-auto border border-border">
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
                  const isMin = toUsdAmount(row[key] as string, row.currency, rates ?? {}) === minValues[key]
                  return (
                    <td
                      key={key}
                      className={cn(
                        "px-4 py-3.5 text-right font-mono tabular-nums",
                        isMin ? "font-semibold text-primary" : "text-foreground",
                      )}
                    >
                      {money(row[key], row.currency)}
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
                  {normalizeUrl(row.sourceUrl, row.registrarWebsite) ? (
                    <a
                      href={normalizeUrl(row.sourceUrl, row.registrarWebsite)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t("pt.visitAria").replace("{name}", row.registrarName)}
                      className="inline-flex text-muted-foreground hover:text-primary"
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
