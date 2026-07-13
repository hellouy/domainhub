"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  retryFailedAction,
  runAdapterAction,
  runAllAdaptersAction,
  updateSchedulerAction,
} from "@/app/actions/crawler"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

interface AdapterInfo {
  slug: string
  name: string
  strategy: string
}

export function SchedulerPanel({
  adapters,
  enabled,
  runHourUtc,
}: {
  adapters: AdapterInfo[]
  enabled: boolean
  runHourUtc: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedSlug, setSelectedSlug] = useState(adapters[0]?.slug ?? "")
  const [message, setMessage] = useState<string | null>(null)

  function run(fn: () => Promise<unknown>, label: string) {
    setMessage(`${label}中…`)
    startTransition(async () => {
      try {
        const result = await fn()
        if (Array.isArray(result)) {
          const ok = result.filter((r) => (r as { ok: boolean }).ok).length
          setMessage(`${label}完成：${ok}/${result.length} 成功`)
        } else if (result && typeof result === "object" && "message" in result) {
          setMessage(`${label}完成：${(result as { message: string }).message}`)
        } else {
          setMessage(`${label}完成`)
        }
        router.refresh()
      } catch (err) {
        setMessage(`${label}失败：${err instanceof Error ? err.message : String(err)}`)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">调度操作</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* 手动运行 */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adapter-select" className="text-xs text-muted-foreground">
              运行单个注册商
            </Label>
            <div className="flex gap-2">
              <Select value={selectedSlug} onValueChange={(v) => setSelectedSlug(v ?? "")}>
                <SelectTrigger id="adapter-select" className="w-44">
                  <SelectValue placeholder="选择注册商" />
                </SelectTrigger>
                <SelectContent>
                  {adapters.map((a) => (
                    <SelectItem key={a.slug} value={a.slug}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={isPending || !selectedSlug}
                onClick={() => run(() => runAdapterAction(selectedSlug), "运行")}
              >
                运行
              </Button>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={() => run(() => runAllAdaptersAction(), "全量运行")}
          >
            全部运行
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => run(() => retryFailedAction(), "重试失败")}
          >
            重试失败
          </Button>
        </div>

        {/* 每日定时 */}
        <div className="flex flex-wrap items-center gap-4 rounded-md border border-border p-3">
          <div className="flex items-center gap-2">
            <Switch
              id="daily-toggle"
              checked={enabled}
              disabled={isPending}
              onCheckedChange={(checked) => run(() => updateSchedulerAction({ enabled: checked }), "更新调度")}
            />
            <Label htmlFor="daily-toggle" className="text-sm">
              每日定时采集
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="hour-select" className="text-xs text-muted-foreground">
              运行时刻（UTC）
            </Label>
            <Select
              value={String(runHourUtc)}
              onValueChange={(v) => run(() => updateSchedulerAction({ runHourUtc: Number(v) }), "更新时刻")}
            >
              <SelectTrigger id="hour-select" className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, h) => (
                  <SelectItem key={h} value={String(h)}>
                    {String(h).padStart(2, "0")}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {message && (
          <p className="text-xs text-muted-foreground" role="status">
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
