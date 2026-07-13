"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun, Languages } from "lucide-react"
import { useLocale } from "@/components/providers"

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
