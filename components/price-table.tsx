"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowUpDown, ExternalLink } from "lucide-react"
import { useCurrency } from "@/lib/currency/context"
import { useI18n } from "@/lib/i18n/context"
import { formatPrice, formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"

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
  /** 换算为 USD 后的价格（非 USD 币种时用于排序与最低价对比） */
  registerUsd?: number | null
  renewUsd?: number | null
  transferUsd?: number | null
}

type SortKey = "registerPrice" | "renewPrice" | "transferPrice"

function toNum(v: string | null) {
  if (v == null) return Number.POSITIVE_INFINITY
  const n = Number.parseFloat(v)
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n
}

/** USD 键映射：排序与最低价均按换算后 USD 计算（无换算值时回退原始值） */
const USD_KEYS: Record<SortKey, "registerUsd" | "renewUsd" | "transferUsd"> = {
  registerPrice: "registerUsd",
  renewPrice: "renewUsd",
  transferPrice: "transferUsd",
}

function toComparable(row: PriceRow, key: SortKey): number {
  const usd = row[USD_KEYS[key]]
  if (usd != null && Number.isFinite(usd)) return usd
  return toNum(row[key])
}

export function PriceTable({ rows, showUpdated = true }: { rows: PriceRow[]; showUpdated?: boolean }) {
  const { dict } = useI18n()
  const { format, isSameCurrency } = useCurrency()
  const [sortKey, setSortKey] = useState<SortKey>("registerPrice")

  const t = dict.home
  const SORT_LABELS: Record<SortKey, string> = {
    registerPrice: t.register,
    renewPrice: t.renew,
    transferPrice: t.transfer,
  }

  const sorted = useMemo(
    () => [...rows].sort((a, b) => toComparable(a, sortKey) - toComparable(b, sortKey)),
    [rows, sortKey],
  )

  const minValues = useMemo(() => {
    const keys: SortKey[] = ["registerPrice", "renewPrice", "transferPrice"]
    const mins: Partial<Record<SortKey, number>> = {}
    for (const key of keys) {
      const vals = rows.map((r) => toComparable(r, key)).filter((v) => Number.isFinite(v))
      if (vals.length > 0) mins[key] = Math.min(...vals)
    }
    return mins
  }, [rows])

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        {t.noPrices}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2" role="group" aria-label="排序方式">
        <ArrowUpDown aria-hidden="true" className="size-4 text-muted-foreground" />
        {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSortKey(key)}
            aria-pressed={sortKey === key}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-95",
              sortKey === key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-secondary-foreground hover:bg-accent",
            )}
          >
            {SORT_LABELS[key]}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary text-left">
              <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {dict.nav.registrars}
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {t.register}
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {t.renew}
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {t.transfer}
              </th>
              {showUpdated && (
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  {dict.common.updatedAt}
                </th>
              )}
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                <span className="sr-only">官网</span>
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
                  const isMin = row[key] != null && toComparable(row, key) === minValues[key]
                  const showOriginal = !isSameCurrency(row.currency) && row[key] != null
                  return (
                    <td
                      key={key}
                      className={cn(
                        "px-4 py-3.5 text-right font-mono tabular-nums",
                        isMin ? "font-semibold text-primary" : "text-foreground",
                      )}
                    >
                      <span className="flex flex-col items-end">
                        <span>{format(row[key], row.currency)}</span>
                        {showOriginal && (
                          <span className="text-xs font-normal text-muted-foreground">
                            {formatPrice(row[key], row.currency)}
                          </span>
                        )}
                      </span>
                      {isMin && <span className="sr-only">（最低价）</span>}
                    </td>
                  )
                })}
                {showUpdated && (
                  <td className="px-4 py-3.5 text-right text-xs text-muted-foreground">
                    {formatRelative(row.updatedAt)}
                  </td>
                )}
                <td className="px-4 py-3.5 text-right">
                  <a
                    href={row.sourceUrl ?? row.registrarWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`访问 ${row.registrarName} 官网`}
                    className="inline-flex text-muted-foreground transition-colors hover:text-primary"
                  >
                    <ExternalLink aria-hidden="true" className="size-4" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
