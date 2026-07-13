"use client"

import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { ChevronDown, Moon, Sun, Languages } from "lucide-react"
import { CURRENCY_OPTIONS, useCurrency, useLocale, type Currency } from "@/components/providers"
import { cn } from "@/lib/utils"

/** 深浅色切换:挂载前渲染占位,避免水合不一致 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const { t } = useLocale()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label={t("nav.themeToggle")}
      title={t("nav.themeToggle")}
      className="flex size-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
    >
      {mounted ? (
        resolvedTheme === "dark" ? (
          <Sun aria-hidden="true" className="size-4" />
        ) : (
          <Moon aria-hidden="true" className="size-4" />
        )
      ) : (
        <span aria-hidden="true" className="size-4" />
      )}
    </button>
  )
}

/** 货币切换下拉:点击展开,选中即全站换算 */
export function CurrencyToggle() {
  const { currency, setCurrency } = useCurrency()
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t("nav.currency")}
        title={t("nav.currency")}
        className="flex h-9 items-center gap-0.5 px-2 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {currency}
        <ChevronDown aria-hidden="true" className={cn("size-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={t("nav.currency")}
          className="absolute right-0 top-full z-50 mt-1 w-24 border border-border bg-popover py-1 shadow-md"
        >
          {CURRENCY_OPTIONS.map((c) => (
            <li key={c}>
              <button
                type="button"
                role="option"
                aria-selected={c === currency}
                onClick={() => {
                  setCurrency(c as Currency)
                  setOpen(false)
                }}
                className={cn(
                  "flex w-full px-3 py-1.5 font-mono text-xs transition-colors hover:bg-accent",
                  c === currency ? "font-semibold text-primary" : "text-popover-foreground",
                )}
              >
                {c}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** 中英文切换 */
export function LocaleToggle() {
  const { locale, setLocale, t } = useLocale()

  return (
    <button
      type="button"
      onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
      aria-label={t("nav.langToggle")}
      title={t("nav.langToggle")}
      className="flex h-9 items-center gap-1 px-2 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <Languages aria-hidden="true" className="size-4" />
      {locale === "zh" ? "EN" : "中"}
    </button>
  )
}
