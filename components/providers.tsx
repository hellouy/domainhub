"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { ThemeProvider } from "next-themes"
import useSWR from "swr"
import { DEFAULT_LOCALE, getDict, LOCALE_COOKIE, type DictKey, type Locale } from "@/lib/i18n"
import { formatMoney } from "@/lib/format"

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

function readCookieLocale(): Locale | null {
  if (typeof document === "undefined") return null
  const m = document.cookie.match(new RegExp(`${LOCALE_COOKIE}=(zh|en)`))
  return (m?.[1] as Locale) ?? null
}

function LocaleProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode
  initialLocale?: Locale
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE)

  // 挂载后校正为 cookie 实际值(中间件按 IP/浏览器写入,或用户手动切换)
  useEffect(() => {
    const fromCookie = readCookieLocale()
    if (fromCookie) setLocaleState(fromCookie)
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

/* ---------- 货币上下文 ---------- */

export const CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "CNY", "JPY", "HKD", "SGD", "CAD", "AUD"] as const
export type Currency = (typeof CURRENCY_OPTIONS)[number]
const CURRENCY_COOKIE = "currency"

type CurrencyContextValue = {
  currency: Currency
  setCurrency: (c: Currency) => void
  /** 原币种金额 → 当前展示币种字符串(汇率未就绪时按原币种显示) */
  money: (value: string | number | null | undefined, from: string) => string
  rates: Record<string, number> | null
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "USD",
  setCurrency: () => {},
  money: (v, from) => formatMoney(v, from, from, null),
  rates: null,
})

export function useCurrency() {
  return useContext(CurrencyContext)
}

function readCookieCurrency(): Currency {
  if (typeof document === "undefined") return "USD"
  const m = document.cookie.match(new RegExp(`${CURRENCY_COOKIE}=([A-Z]{3})`))
  const c = m?.[1] as Currency | undefined
  return c && (CURRENCY_OPTIONS as readonly string[]).includes(c) ? c : "USD"
}

const ratesFetcher = (url: string) => fetch(url).then((r) => r.json())

function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("USD")

  useEffect(() => {
    setCurrencyState(readCookieCurrency())
  }, [])

  const { data } = useSWR<{ rates: Record<string, number> }>("/api/v1/rates", ratesFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 3600_000,
  })
  const rates = data?.rates ?? null

  const setCurrency = useCallback((next: Currency) => {
    setCurrencyState(next)
    document.cookie = `${CURRENCY_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
  }, [])

  const money = useCallback(
    (value: string | number | null | undefined, from: string) =>
      formatMoney(value, from, rates ? currency : from, rates),
    [currency, rates],
  )

  const ctx = useMemo(() => ({ currency, setCurrency, money, rates }), [currency, setCurrency, money, rates])

  return <CurrencyContext.Provider value={ctx}>{children}</CurrencyContext.Provider>
}

/* ---------- 组合提供者 ---------- */

export function Providers({
  children,
  initialLocale,
}: {
  children: React.ReactNode
  initialLocale?: Locale
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <LocaleProvider initialLocale={initialLocale}>
        <CurrencyProvider>{children}</CurrencyProvider>
      </LocaleProvider>
    </ThemeProvider>
  )
}
