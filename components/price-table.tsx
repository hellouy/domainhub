"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowUpDown, ExternalLink } from "lucide-react"
import { formatRelative } from "@/lib/format"
import { useCurrency } from "@/components/providers"
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
}

type SortKey = "registerPrice" | "renewPrice" | "transferPrice"

const SORT_LABELS: Record<SortKey, string> = {
  registerPrice: "注册价",
  renewPrice: "续费价",
  transferPrice: "转入价",
}

function toNum(v: string | null) {
  if (v == null) return Number.POSITIVE_INFINITY
  const n = Number.parseFloat(v)
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n
}

export function PriceTable({ rows, showUpdated = true }: { rows: PriceRow[]; showUpdated?: boolean }) {
  const { money } = useCurrency()
  const [sortKey, setSortKey] = useState<SortKey>("registerPrice")

  const sorted = useMemo(
    () => [...rows].sort((a, b) => toNum(a[sortKey]) - toNum(b[sortKey])),
    [rows, sortKey],
  )

  const minValues = useMemo(() => {
    const keys: SortKey[] = ["registerPrice", "renewPrice", "transferPrice"]
    const mins: Partial<Record<SortKey, number>> = {}
    for (const key of keys) {
      const vals = rows.map((r) => toNum(r[key])).filter((v) => Number.isFinite(v))
      if (vals.length > 0) mins[key] = Math.min(...vals)
    }
    return mins
  }, [rows])

  if (rows.length === 0) {
    return <p className="border border-border bg-card p-8 text-center text-sm text-muted-foreground">暂无价格数据</p>
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
              "px-3 py-1.5 text-xs font-medium transition-colors",
              sortKey === key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent",
            )}
          >
            按{SORT_LABELS[key]}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary text-left">
              <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                注册商
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                注册
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                续费
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                转入
              </th>
              {showUpdated && (
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  更新时间
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
                  const isMin = row[key] != null && toNum(row[key]) === minValues[key]
                  return (
                    <td
                      key={key}
                      className={cn(
                        "px-4 py-3.5 text-right font-mono tabular-nums",
                        isMin ? "font-semibold text-primary" : "text-foreground",
                      )}
                    >
                      {money(row[key], row.currency)}
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
                    className="inline-flex text-muted-foreground hover:text-primary"
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
