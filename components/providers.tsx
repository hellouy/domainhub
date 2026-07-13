"use client"

import { CurrencyProvider, type DisplayCurrency, type RateMap } from "@/lib/currency/context"
import { I18nProvider } from "@/lib/i18n/context"
import type { Locale } from "@/lib/i18n/dictionaries"

export function Providers({
  locale,
  currency,
  rates,
  children,
}: {
  locale: Locale
  currency: DisplayCurrency
  rates: RateMap
  children: React.ReactNode
}) {
  return (
    <I18nProvider initialLocale={locale}>
      <CurrencyProvider initialCurrency={currency} rates={rates}>
        {children}
      </CurrencyProvider>
    </I18nProvider>
  )
}
