"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { useCurrency } from "@/lib/currency/context"
import { useI18n } from "@/lib/i18n/context"

type TldOption = {
  tld: string
  type: string
  minRegister: string | null
  /** 最低价所属币种（用于换算展示） */
  minRegisterCurrency?: string | null
}

export function TldSearch({ options }: { options: TldOption[] }) {
  const router = useRouter()
  const { dict } = useI18n()
  const { format } = useCurrency()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const normalized = query.trim().toLowerCase().replace(/^\.+/, "").replace(/^.*\./, "")

  const suggestions = useMemo(() => {
    if (!normalized) return options.slice(0, 6)
    return options.filter((o) => o.tld.startsWith(normalized)).slice(0, 6)
  }, [normalized, options])

  function go(tld: string) {
    setOpen(false)
    router.push(`/tld/${tld}`)
  }

  function submit() {
    if (suggestions.length > 0) {
      go(suggestions[0].tld)
    } else if (normalized) {
      go(normalized)
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 shadow-sm transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <Search aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
              submit()
            }
          }}
          placeholder={dict.search.placeholder}
          aria-label={dict.search.ariaLabel}
          className="w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={submit}
          className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-95"
        >
          {dict.search.button}
        </button>
      </div>
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label={dict.search.suggestionsLabel}
          className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-popover p-1 shadow-lg"
        >
          {suggestions.map((s) => (
            <li key={s.tld}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(s.tld)}
                className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-colors hover:bg-accent active:scale-[0.98]"
              >
                <span className="font-mono text-sm font-medium">.{s.tld}</span>
                <span className="text-xs text-muted-foreground">
                  {s.minRegister
                    ? `${dict.search.lowestPrefix} ${format(s.minRegister, s.minRegisterCurrency ?? "USD")}`
                    : dict.search.noPrice}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
