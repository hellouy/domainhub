"use client"

import { useTransition } from "react"
import { toggleAdPosition } from "@/app/actions/admin"
import { AD_POSITIONS } from "@/lib/ad-positions"
import { cn } from "@/lib/utils"
import { ToggleRight, ToggleLeft } from "lucide-react"

type Props = {
  /** 当前启用的位置列表，null = 全部启用 */
  enabledPositions: string[] | null
  /** 每个位置当前的广告数量 */
  adCounts: Record<string, number>
}

export function AdPositionToggle({ enabledPositions, adCounts }: Props) {
  const [pending, startTransition] = useTransition()

  const isEnabled = (pos: string) => {
    if (enabledPositions === null) return true
    return enabledPositions.includes(pos)
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-base font-semibold text-foreground">位置开关</h2>
        <span className="text-xs text-muted-foreground">
          控制哪些位置在前台展示广告。关闭后该位置即使有广告也不会显示。
        </span>
      </div>
      <ul className="mt-4 flex flex-col divide-y divide-border">
        {AD_POSITIONS.map((p) => {
          const enabled = isEnabled(p.position)
          const count = adCounts[p.position] ?? 0
          return (
            <li key={p.position} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <code className="rounded bg-muted px-2 py-0.5 text-xs text-primary">{p.position}</code>
                <span className="text-sm text-foreground">{p.label}</span>
                <span className="text-xs text-muted-foreground">{count} 条广告</span>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => toggleAdPosition(p.position, !enabled))}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  enabled
                    ? "text-green-600 hover:bg-green-500/10"
                    : "text-muted-foreground hover:bg-accent",
                  pending && "opacity-50",
                )}
              >
                {enabled ? (
                  <ToggleRight className="size-4" aria-hidden />
                ) : (
                  <ToggleLeft className="size-4" aria-hidden />
                )}
                {enabled ? "已启用" : "已关闭"}
              </button>
            </li>
          )
        })}
      </ul>
      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <span>
          {enabledPositions === null
            ? "当前：全部位置已启用"
            : `当前：${enabledPositions.length} / ${AD_POSITIONS.length} 个位置已启用`}
        </span>
      </div>
    </div>
  )
}
