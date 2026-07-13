"use client"

import { useLocale } from "@/components/providers"
import type { DictKey } from "@/lib/i18n"

/** 服务端组件里嵌入可翻译文案的轻量桥接组件 */
export function T({ k }: { k: DictKey }) {
  const { t } = useLocale()
  return <>{t(k)}</>
}
