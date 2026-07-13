"use client"

import { useCurrency } from "@/components/providers"

/**
 * 统一价格显示:原币种金额按右上角选中的货币实时换算。
 * 服务端组件中直接 <Money value={price} from="EUR" /> 即可。
 */
export function Money({
  value,
  from = "USD",
}: {
  value: string | number | null | undefined
  from?: string
}) {
  const { money } = useCurrency()
  return <>{money(value, from)}</>
}
