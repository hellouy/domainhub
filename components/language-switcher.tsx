"use client"

import { Languages } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import { cn } from "@/lib/utils"

/** 中英文切换：两段式分段控件，点按即切换并写入 Cookie */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, dict } = useI18n()

  return (
    <div
      role="group"
      aria-label={dict.nav.language}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border bg-secondary/60 p-0.5",
        className,
      )}
    >
      <Languages aria-hidden="true" className="ml-1.5 mr-0.5 size-3.5 text-muted-foreground" />
      {(["zh", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium transition-all active:scale-95",
            locale === code
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {code === "zh" ? "中" : "EN"}
        </button>
      ))}
    </div>
  )
}
