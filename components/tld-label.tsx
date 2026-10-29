import { isIdnTld, tldToUnicode } from "@/lib/tld-display"
import { cn } from "@/lib/utils"

type TldLabelProps = {
  /** 数据库中的原始后缀（可能是 punycode，如 xn--fiqs8s） */
  tld: string
  /** 是否显示前导「.」，默认 true */
  withDot?: boolean
  /** 是否在 IDN 后缀右上角显示 IDN 标签，默认 true */
  showBadge?: boolean
  className?: string
}

/**
 * 后缀显示组件：punycode 自动转为 Unicode（.xn--fiqs8s → .中国），
 * IDN 后缀右上角附带一个小号 IDN 标签。
 */
export function TldLabel({ tld, withDot = true, showBadge = true, className }: TldLabelProps) {
  const label = (withDot ? "." : "") + tldToUnicode(tld)
  const idn = isIdnTld(tld)

  if (!idn || !showBadge) {
    return <span className={className}>{label}</span>
  }

  return (
    <span className={cn("inline-flex items-start gap-1", className)}>
      <span>{label}</span>
      <span className="mt-0.5 shrink-0 border border-primary/40 bg-primary/10 px-1 py-px font-sans text-[9px] font-semibold uppercase leading-none tracking-wide text-primary">
        IDN
      </span>
    </span>
  )
}
