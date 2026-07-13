"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { useCurrency, useLocale } from "@/components/providers"

export type TldSearchOption = {
  tld: string
  type: string
  minRegister: string | null
}

export function TldSearch({ options }: { options: TldSearchOption[] }) {
  const { t } = useLocale()
  const { money } = useCurrency()
  const router = useRouter()
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
      <div className="flex items-center gap-2 border border-border bg-card px-4 py-3 focus-within:border-primary">
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
          placeholder={t("search.placeholder")}
          aria-label={t("search.placeholder")}
          className="w-full min-w-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={submit}
          className="shrink-0 bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 md:px-4"
        >
          {t("search.button")}
        </button>
      </div>
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label="后缀建议"
          className="absolute inset-x-0 top-full z-50 mt-1 border border-border bg-popover shadow-lg"
        >
          {suggestions.map((s) => (
            <li key={s.tld}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(s.tld)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-accent"
              >
                <span className="font-mono text-sm font-medium">.{s.tld}</span>
                <span className="text-xs text-muted-foreground">
                  {s.minRegister ? `最低 ${money(s.minRegister, "USD")}` : "暂无价格"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
