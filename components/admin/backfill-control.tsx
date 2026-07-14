"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  runBatchNowAction,
  startBackfillAction,
  stopBackfillAction,
} from "@/app/actions/backfill"

export interface BackfillState {
  status: string
  cursor: number
  batchSize: number
  total: number
  batchesDone: number
  pricesUpdated: number
  lastBatchAt: string | null
  startedAt: string | null
}

const STATUS_LABEL: Record<string, string> = {
  idle: "未开始",
  running: "进行中",
  completed: "已完成",
  stopped: "已停止",
}

export function BackfillControl({
  registrarId,
  registrarName,
  state,
}: {
  registrarId: number
  registrarName: string
  state: BackfillState | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string>("")

  const status = state?.status ?? "idle"
  const total = state?.total ?? 0
  const done = state ? Math.min(state.cursor, total) : 0
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  const isRunning = status === "running"

  const wrap = (fn: () => Promise<unknown>, ok: string) =>
    startTransition(async () => {
      try {
        setMessage("")
        await fn()
        setMessage(ok)
        router.refresh()
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "操作失败")
      }
    })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground">{registrarName} 全量回填</span>
        <Badge
          variant={
            status === "running" ? "default" : status === "completed" ? "secondary" : "outline"
          }
        >
          {STATUS_LABEL[status] ?? status}
        </Badge>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        按 IANA 有效后缀分批采集（每批 {state?.batchSize ?? 50} 个），cron 每 5 分钟推进一批，直至采完。
        采完后 cron 自动空转，日常仅采热门后缀。
      </p>

      {/* 进度条 */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            进度 {done} / {total}（{percent}%）
          </span>
          <span>
            已跑 {state?.batchesDone ?? 0} 批 · 累计更新 {state?.pricesUpdated ?? 0} 条
          </span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="回填进度"
        >
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {!isRunning ? (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => wrap(() => startBackfillAction(registrarId), "已启动回填")}
          >
            {status === "stopped" ? "重新启动" : "启动回填"}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => wrap(() => stopBackfillAction(registrarId), "已停止")}
          >
            停止
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={pending || status === "completed"}
          onClick={() => wrap(() => runBatchNowAction(registrarId), "已手动跑一批")}
        >
          立即跑一批
        </Button>
      </div>

      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  )
}
