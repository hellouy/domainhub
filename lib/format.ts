const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  CNY: "¥",
  EUR: "€",
  GBP: "£",
  JPY: "JP¥",
  CHF: "CHF ",
  SEK: "SEK ",
  NOK: "NOK ",
  NZD: "NZ$",
  CAD: "CA$",
}

/** 价格格式化：numeric 字段以 string 返回；日元不显示小数 */
export function formatPrice(value: string | number | null | undefined, currency = "USD") {
  if (value == null) return "—"
  const num = typeof value === "string" ? Number.parseFloat(value) : value
  if (Number.isNaN(num)) return "—"
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `
  return `${symbol}${currency === "JPY" ? Math.round(num).toLocaleString() : num.toFixed(2)}`
}

/**
 * 跨币种换算(客户端安全,不依赖数据库)。
 * rates 为 USD 基准:1 USD = rates[X] 单位 X 货币。
 */
export function convertAmount(
  value: number,
  from: string,
  to: string,
  rates: Record<string, number> | null | undefined,
): number {
  if (from === to || !rates) return value
  const rFrom = rates[from]
  const rTo = rates[to]
  if (!rFrom || rFrom <= 0) return value
  const usd = value / rFrom
  return rTo && rTo > 0 ? usd * rTo : usd
}

/** 换算并格式化:原币种金额 → 目标展示币种字符串 */
export function formatMoney(
  value: string | number | null | undefined,
  from: string,
  to: string,
  rates: Record<string, number> | null | undefined,
): string {
  if (value == null) return "—"
  const num = typeof value === "string" ? Number.parseFloat(value) : value
  if (Number.isNaN(num)) return "—"
  return formatPrice(convertAmount(num, from, to, rates), to)
}

import type { Locale } from "@/lib/i18n"

export function formatDate(value: Date | string | null | undefined, locale: Locale = "zh") {
  if (!value) return "—"
  const d = typeof value === "string" ? new Date(value) : value
  const bcp47 = locale === "en" ? "en-US" : "zh-CN"
  return d.toLocaleDateString(bcp47, { year: "numeric", month: "short", day: "numeric" })
}

export function formatDateTime(value: Date | string | null | undefined, locale: Locale = "zh") {
  if (!value) return "—"
  const d = typeof value === "string" ? new Date(value) : value
  const bcp47 = locale === "en" ? "en-US" : "zh-CN"
  return d.toLocaleString(bcp47, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** 相对时间（如“3 小时前” / “3 h ago”），随语言本地化 */
export function formatRelative(value: Date | string | null | undefined, locale: Locale = "zh") {
  if (!value) return "—"
  const d = typeof value === "string" ? new Date(value) : value
  const diff = Date.now() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  const en = locale === "en"
  if (minutes < 1) return en ? "just now" : "刚刚"
  if (minutes < 60) return en ? `${minutes} min ago` : `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return en ? `${hours} h ago` : `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return en ? `${days} d ago` : `${days} 天前`
  return formatDate(d, locale)
}

/** 后缀类型 → 本地化标签 */
const TLD_TYPE_LABELS_ZH: Record<string, string> = {
  gTLD: "通用顶级域名",
  ccTLD: "国家域名",
  newG: "新顶级域名",
}
const TLD_TYPE_LABELS_EN: Record<string, string> = {
  gTLD: "Generic TLD",
  ccTLD: "Country-code TLD",
  newG: "New gTLD",
}
export function tldTypeLabel(type: string, locale: Locale = "zh") {
  const map = locale === "en" ? TLD_TYPE_LABELS_EN : TLD_TYPE_LABELS_ZH
  return map[type] ?? type
}

/** 兼容旧用法（默认中文） */
export const TLD_TYPE_LABELS = TLD_TYPE_LABELS_ZH
