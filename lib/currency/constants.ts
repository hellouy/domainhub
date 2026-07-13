/** 货币相关常量与纯函数（服务端/客户端通用，无 "use client"） */

/** 支持切换的展示币种（可扩展） */
export const DISPLAY_CURRENCIES = ["USD", "CNY", "EUR", "GBP"] as const
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number]
export const DEFAULT_CURRENCY: DisplayCurrency = "USD"
export const CURRENCY_COOKIE = "dh_currency"

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  CNY: "¥",
  EUR: "€",
  GBP: "£",
}

export const CURRENCY_LABELS: Record<DisplayCurrency, string> = {
  USD: "USD $",
  CNY: "CNY ¥",
  EUR: "EUR €",
  GBP: "GBP £",
}

/** 汇率表：币种 → 1 USD 兑该币种数量 */
export type RateMap = Record<string, number>

export function normalizeCurrency(value: string | undefined | null): DisplayCurrency {
  const upper = (value ?? "").toUpperCase()
  return (DISPLAY_CURRENCIES as readonly string[]).includes(upper)
    ? (upper as DisplayCurrency)
    : DEFAULT_CURRENCY
}
