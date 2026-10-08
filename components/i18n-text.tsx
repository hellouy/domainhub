"use client"

import { useLocale } from "@/components/providers"
import { formatRelative, tldTypeLabel } from "@/lib/format"
import { registrarDescription } from "@/lib/registrar-content"
import type { DictKey } from "@/lib/i18n"

/** 服务端组件里嵌入可翻译文案的轻量桥接组件 */
export function T({ k }: { k: DictKey }) {
  const { t } = useLocale()
  return <>{t(k)}</>
}

/** 带插值的翻译文案，如 "{n}" → count */
export function TCount({ k, vars }: { k: DictKey; vars: Record<string, string | number> }) {
  const { t } = useLocale()
  let s: string = t(k)
  for (const [key, val] of Object.entries(vars)) s = s.replace(`{${key}}`, String(val))
  return <>{s}</>
}

/** 相对时间，随语言本地化（如“3 小时前” / “3 h ago”） */
export function RelativeTime({ date }: { date: Date | string | null | undefined }) {
  const { locale } = useLocale()
  return <>{formatRelative(date, locale)}</>
}

/** 后缀类型标签（通用 / 国家 / 新顶级） */
export function TldType({ type, compact = false }: { type: string; compact?: boolean }) {
  const { locale, t } = useLocale()
  if (compact) {
    const key =
      type === "ccTLD"
        ? "type.short.ccTLD"
        : type === "newG"
          ? "type.short.newG"
          : "type.short.gTLD"
    return <>{t(key)}</>
  }
  return <>{tldTypeLabel(type, locale)}</>
}

/** “数据更新于 {相对时间}”，模板与时间都随语言本地化 */
export function DataUpdated({ date }: { date: Date | string | null | undefined }) {
  const { locale, t } = useLocale()
  return <>{t("tld.dataUpdated").replace("{t}", formatRelative(date, locale))}</>
}

/** 注册商双语介绍：按当前语言取值，英文缺失时留空 */
export function RegistrarDescription({
  slug,
  fallback,
  className,
}: {
  slug: string
  fallback: string
  className?: string
}) {
  const { locale } = useLocale()
  const description = registrarDescription(slug, fallback, locale)
  if (!description) return null
  if (className) return <p className={className}>{description}</p>
  return <>{description}</>
}
