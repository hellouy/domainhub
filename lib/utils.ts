import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 归一化 URL:去空白,空串/null/undefined 一律返回 undefined。
 * 用于 href,避免把空字符串传给 <a href>(React 会告警且是无效链接)。
 */
export function normalizeUrl(...candidates: (string | null | undefined)[]): string | undefined {
  for (const c of candidates) {
    const v = c?.trim()
    if (v) return v
  }
  return undefined
}
