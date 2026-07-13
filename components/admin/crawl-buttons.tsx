"use client"

import { useState, useTransition } from "react"
import { triggerCrawl, triggerCrawlAll } from "@/app/actions/admin"
import type { CrawlJobResult } from "@/lib/crawler/runner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export function CrawlAllButton() {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  return (
    <div className="flex items-center gap-3">
      {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const results = await triggerCrawlAll()
            const ok = results.filter((r) => r.ok).length
            setMessage(`完成：${ok}/${results.length} 个注册商采集成功`)
            router.refresh()
          })
        }
      >
        {pending ? "采集中…" : "全量采集"}
      </Button>
    </div>
  )
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

export function CrawlOneButton({ registrarId, label }: { registrarId: number; label?: string }) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<CrawlJobResult | null>(null)
  const router = useRouter()

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {pending ? (
          <Badge variant="secondary">采集中…</Badge>
        ) : result ? (
          <Badge variant={result.ok ? "default" : "destructive"}>{result.ok ? "完成" : "失败"}</Badge>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setResult(null)
              const r = await triggerCrawl(registrarId)
              setResult(r)
              router.refresh()
            })
          }
        >
          {pending ? "采集中…" : (label ?? "采集")}
        </Button>
      </div>
      {result ? (
        result.ok ? (
          <p className="text-right text-xs text-muted-foreground">
            后缀 {result.totalTlds} · 更新 {result.updated} 行 · 耗时 {formatDuration(result.durationMs)}
          </p>
        ) : (
          <p className="max-w-52 text-right text-xs text-destructive">{result.error}</p>
        )
      ) : null}
    </div>
  )
}
