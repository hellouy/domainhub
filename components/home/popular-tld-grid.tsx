"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, ChevronDown, ExternalLink } from "lucide-react"
import type { PopularTldWithPrices } from "@/lib/db/queries"
import { useCurrency } from "@/lib/currency/context"
import { useI18n } from "@/lib/i18n/context"
import { cn } from "@/lib/utils"

export function PopularTldGrid({ tlds }: { tlds: PopularTldWithPrices[] }) {
  const [activeId, setActiveId] = useState<number | null>(null)

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {tlds.map((item) => (
        <TldCard
          key={item.id}
          item={item}
          active={activeId === item.id}
          onToggle={() => setActiveId((prev) => (prev === item.id ? null : item.id))}
        />
      ))}
    </ul>
  )
}

function TldCard({
  item,
  active,
  onToggle,
}: {
  item: PopularTldWithPrices
  active: boolean
  onToggle: () => void
}) {
  const { dict, locale } = useI18n()
  const { convert, format } = useCurrency()
  const t = dict.home

  // 按选定币种换算注册价并排序，取最低
  const rows = useMemo(() => {
    return item.prices
      .map((p) => ({ ...p, registerConverted: convert(p.registerPrice, p.currency) }))
      .sort((a, b) => {
        const av = a.registerConverted ?? Number.POSITIVE_INFINITY
        const bv = b.registerConverted ?? Number.POSITIVE_INFINITY
        return av - bv
      })
  }, [item.prices, convert])

  const cheapest = rows.find((r) => r.registerConverted != null) ?? null
  const lowestValue = cheapest?.registerConverted ?? null
  const topRows = rows.slice(0, 5)

  const registrarCountText =
    locale === "en"
      ? `${item.registrarCount} ${dict.common.registrarsUnit}`
      : `${item.registrarCount} ${dict.common.registrarsUnit}`

  return (
    <li className={cn(active && "sm:col-span-2")}>
      <div
        className={cn(
          "overflow-hidden rounded-2xl border bg-card transition-all",
          active
            ? "border-primary/60 shadow-md"
            : "border-border hover:border-primary/40 hover:shadow-sm",
        )}
      >
        {/* 卡片头部：点按展开 */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={active}
          className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors active:bg-accent/50"
        >
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xl font-semibold">.{item.tld}</span>
            <span className="text-xs text-muted-foreground">{registrarCountText}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {t.lowestRegister}
              </span>
              <span className="font-mono text-2xl font-semibold tabular-nums text-primary">
                {cheapest ? format(cheapest.registerPrice, cheapest.currency) : "—"}
              </span>
            </div>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-5 shrink-0 text-muted-foreground transition-transform",
                active && "rotate-180",
              )}
            />
          </div>
        </button>

        {/* 内联展开：比价明细 */}
        {active && (
          <div className="animate-in fade-in slide-in-from-top-2 border-t border-border">
            {topRows.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">{t.noPrices}</p>
            ) : (
              <div className="flex flex-col">
                <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-2.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <span>{dict.nav.registrars}</span>
                  <span className="text-right">{t.register}</span>
                  <span className="text-right">{t.renew}</span>
                </div>
                {topRows.map((row, i) => {
                  const isMin = row.registerConverted != null && row.registerConverted === lowestValue
                  return (
                    <a
                      key={row.registrarSlug}
                      href={row.sourceUrl ?? row.registrarWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "grid grid-cols-[1fr_auto_auto] items-center gap-4 border-t border-border/60 px-5 py-3 text-sm transition-colors hover:bg-accent/50 active:scale-[0.99]",
                        i === 0 && "border-t-0",
                      )}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        {row.registrarName}
                        {isMin && (
                          <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-medium text-primary">
                            {t.cheapest}
                          </span>
                        )}
                        <ExternalLink aria-hidden="true" className="size-3 text-muted-foreground" />
                      </span>
                      <span
                        className={cn(
                          "text-right font-mono tabular-nums",
                          isMin ? "font-semibold text-primary" : "text-foreground",
                        )}
                      >
                        {format(row.registerPrice, row.currency)}
                      </span>
                      <span className="text-right font-mono tabular-nums text-muted-foreground">
                        {format(row.renewPrice, row.currency)}
                      </span>
                    </a>
                  )
                })}
                <Link
                  href={`/compare/${item.tld}`}
                  className="flex items-center justify-center gap-1.5 border-t border-border px-5 py-3.5 text-sm font-medium text-primary transition-colors hover:bg-accent/50 active:scale-[0.99]"
                >
                  {t.viewFullCompare}
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  )
}
