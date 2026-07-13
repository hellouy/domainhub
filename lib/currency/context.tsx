"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import {
  CURRENCY_COOKIE,
  CURRENCY_SYMBOLS,
  type DisplayCurrency,
  type RateMap,
} from "./constants"

export {
  CURRENCY_LABELS,
  CURRENCY_SYMBOLS,
  DEFAULT_CURRENCY,
  DISPLAY_CURRENCIES,
  type DisplayCurrency,
  normalizeCurrency,
  type RateMap,
} from "./constants"

type CurrencyContextValue = {
  currency: DisplayCurrency
  setCurrency: (currency: DisplayCurrency) => void
  /** 将 (amount, fromCurrency) 换算为当前展示币种，返回数字 */
  convert: (amount: number | string | null | undefined, fromCurrency: string) => number | null
  /** 换算并格式化为带符号字符串 */
  format: (amount: number | string | null | undefined, fromCurrency: string) => string
  /** 判断某原始币种是否与当前展示币种一致 */
  isSameCurrency: (fromCurrency: string) => boolean
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

function writeCurrencyCookie(currency: DisplayCurrency) {
  document.cookie = `${CURRENCY_COOKIE}=${currency}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
}

export function CurrencyProvider({
  initialCurrency,
  rates,
  children,
}: {
  initialCurrency: DisplayCurrency
  rates: RateMap
  children: React.ReactNode
}) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>(initialCurrency)

  const setCurrency = useCallback((next: DisplayCurrency) => {
    setCurrencyState(next)
    writeCurrencyCookie(next)
  }, [])

  const convert = useCallback(
    (amount: number | string | null | undefined, fromCurrency: string): number | null => {
      if (amount === null || amount === undefined) return null
      const num = typeof amount === "string" ? Number.parseFloat(amount) : amount
      if (!Number.isFinite(num)) return null
      const from = fromCurrency.toUpperCase()
      if (from === currency) return num
      const fromRate = from === "USD" ? 1 : rates[from]
      const toRate = currency === "USD" ? 1 : rates[currency]
      if (!fromRate || fromRate <= 0 || !toRate || toRate <= 0) return null
      // 先回到 USD，再换到目标币种
      return (num / fromRate) * toRate
    },
    [currency, rates],
  )

  const format = useCallback(
    (amount: number | string | null | undefined, fromCurrency: string): string => {
      const value = convert(amount, fromCurrency)
      if (value === null) return "—"
      const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `
      const decimals = currency === "CNY" ? 0 : 2
      return `${symbol}${value.toFixed(decimals)}`
    },
    [convert, currency],
  )

  const isSameCurrency = useCallback(
    (fromCurrency: string) => fromCurrency.toUpperCase() === currency,
    [currency],
  )

  const value = useMemo<CurrencyContextValue>(
    () => ({ currency, setCurrency, convert, format, isSameCurrency }),
    [currency, setCurrency, convert, format, isSameCurrency],
  )

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error("useCurrency 必须在 CurrencyProvider 内使用")
  return ctx
}
