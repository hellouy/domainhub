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

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—"
  const d = typeof value === "string" ? new Date(value) : value
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" })
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—"
  const d = typeof value === "string" ? new Date(value) : value
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** 相对时间（如“3 小时前”） */
export function formatRelative(value: Date | string | null | undefined) {
  if (!value) return "—"
  const d = typeof value === "string" ? new Date(value) : value
  const diff = Date.now() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "刚刚"
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return formatDate(d)
}

export const TLD_TYPE_LABELS: Record<string, string> = {
  gTLD: "通用顶级域名",
  ccTLD: "国家域名",
  newG: "新顶级域名",
}
