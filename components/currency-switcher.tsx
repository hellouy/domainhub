"use client"

import { useState } from "react"
import { Check, ChevronDown, Coins } from "lucide-react"
import {
  CURRENCY_LABELS,
  DISPLAY_CURRENCIES,
  type DisplayCurrency,
  useCurrency,
} from "@/lib/currency/context"
import { useI18n } from "@/lib/i18n/context"
import { cn } from "@/lib/utils"

/** 货币切换：紧凑下拉，点按选择后写入 Cookie，全站价格即时换算 */
export function CurrencySwitcher({ className }: { className?: string }) {
  const { currency, setCurrency } = useCurrency()
  const { dict } = useI18n()
  const [open, setOpen] = useState(false)

  function choose(next: DisplayCurrency) {
    setCurrency(next)
    setOpen(false)
  }

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={dict.nav.currency}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium transition-all hover:bg-secondary active:scale-95"
      >
        <Coins aria-hidden="true" className="size-3.5 text-muted-foreground" />
        <span className="tabular-nums">{currency}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <ul
            role="listbox"
            aria-label={dict.nav.currency}
            className="absolute right-0 top-full z-50 mt-2 min-w-[9rem] overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg"
          >
            {DISPLAY_CURRENCIES.map((code) => (
              <li key={code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={currency === code}
                  onClick={() => choose(code)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors active:scale-[0.98]",
                    currency === code ? "bg-accent font-medium" : "hover:bg-accent/60",
                  )}
                >
                  <span>{CURRENCY_LABELS[code]}</span>
                  {currency === code && <Check aria-hidden="true" className="size-4 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
