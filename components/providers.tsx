"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { ThemeProvider } from "next-themes"
import { DEFAULT_LOCALE, getDict, LOCALE_COOKIE, type DictKey, type Locale } from "@/lib/i18n"

/* ---------- 语言上下文 ---------- */

type LocaleContextValue = {
  locale: Locale
  t: (key: DictKey) => string
  setLocale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  t: (key) => getDict(DEFAULT_LOCALE)[key],
  setLocale: () => {},
})

export function useLocale() {
  return useContext(LocaleContext)
}

function readCookieLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE
  const m = document.cookie.match(new RegExp(`${LOCALE_COOKIE}=(zh|en)`))
  return (m?.[1] as Locale) ?? DEFAULT_LOCALE
}

function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  // 挂载后读取 cookie,避免 SSR 与客户端初值不一致
  useEffect(() => {
    setLocaleState(readCookieLocale())
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en"
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
  }, [])

  const t = useCallback((key: DictKey) => getDict(locale)[key], [locale])

  return <LocaleContext.Provider value={{ locale, t, setLocale }}>{children}</LocaleContext.Provider>
}

/* ---------- 组合提供者 ---------- */

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <LocaleProvider>{children}</LocaleProvider>
    </ThemeProvider>
  )
}
