"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import {
  type Dictionary,
  type Locale,
  getDictionary,
  LOCALE_COOKIE,
} from "./dictionaries"

type I18nContextValue = {
  locale: Locale
  dict: Dictionary
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

/** 一年有效期的 Cookie 写入 */
function writeLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
}

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale
  children: React.ReactNode
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    writeLocaleCookie(next)
    if (typeof document !== "undefined") {
      document.documentElement.lang = next === "en" ? "en" : "zh-CN"
    }
  }, [])

  const value = useMemo<I18nContextValue>(
    () => ({ locale, dict: getDictionary(locale), setLocale }),
    [locale, setLocale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n 必须在 I18nProvider 内使用")
  return ctx
}

/** 简易插值：将 "{key}" 替换为 params[key] */
export function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`))
}
