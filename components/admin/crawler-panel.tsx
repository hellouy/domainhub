"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  retryJobAction,
  runAdapterAction,
  runAllAdaptersAction,
  stopJobAction,
} from "@/app/actions/crawler"
import type { CrawlJobResult } from "@/lib/crawler/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export interface AdapterRow {
  slug: string
  name: string
  strategy: string
  isActive: boolean
  lastJob: {
    id: number
    status: string
    startedAt: string | null
    finishedAt: string | null
    durationMs: number | null
    totalTlds: number
    pricesUpdated: number
    errorMessage: string | null
  } | null
}

const STATUS_LABEL: Record<string, string> = {
  pending: "待运行",
  running: "运行中",
  success: "成功",
  failed: "失败",
  cancelled: "已取消",
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "success" ? "default" : status === "failed" ? "destructive" : "secondary"
  return <Badge variant={variant}>{STATUS_LABEL[status] ?? status}</Badge>
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—"
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function formatTime(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("zh-CN", { hour12: false })
}

export function CrawlerPanel({ rows }: { rows: AdapterRow[] }) {
  const router = useRouter()
  const [runningAll, startRunAll] = useTransition()
  const [runningSlug, setRunningSlug] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, CrawlJobResult>>({})
  const [summary, setSummary] = useState<string | null>(null)

  const record = (r: CrawlJobResult) =>
    setResults((prev) => ({ ...prev, [r.registrarSlug]: r }))

  const runOne = (slug: string) => {
    setRunningSlug(slug)
    startRunAll(async () => {
      try {
        record(await runAdapterAction(slug))
      } finally {
        setRunningSlug(null)
        router.refresh()
      }
    })
  }

  const runAll = () => {
    setSummary(null)
    startRunAll(async () => {
      const all = await runAllAdaptersAction()
      for (const r of all) record(r)
      setSummary(`完成：${all.filter((r) => r.ok).length}/${all.length} 个 Adapter 成功`)
      router.refresh()
    })
  }

  const stop = (jobId: number) => {
    startRunAll(async () => {
      await stopJobAction(jobId)
      router.refresh()
    })
  }

  const retry = (slug: string, jobId: number) => {
    setRunningSlug(slug)
    startRunAll(async () => {
      try {
        record(await retryJobAction(jobId))
      } finally {
        setRunningSlug(null)
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={runAll} disabled={runningAll}>
          {runningAll && runningSlug === null ? "运行中…" : "运行全部"}
        </Button>
        {summary ? <span className="text-sm text-muted-foreground">{summary}</span> : null}
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((row) => {
          const fresh = results[row.slug]
          const isRunning = runningSlug === row.slug
          const lastStatus = fresh?.status ?? row.lastJob?.status
          const lastJobId = fresh?.jobId ?? row.lastJob?.id
          const canRetry = lastStatus === "failed" || lastStatus === "cancelled"
          const isJobRunning = row.lastJob?.status === "running" && !fresh

          return (
            <Card key={row.slug}>
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{row.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{row.slug}</span>
                    {!row.isActive ? <Badge variant="outline">已停用</Badge> : null}
                    {isRunning ? (
                      <Badge variant="secondary">运行中…</Badge>
                    ) : lastStatus ? (
                      <StatusBadge status={lastStatus} />
                    ) : (
                      <Badge variant="outline">从未运行</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={runningAll || !row.isActive}
                      onClick={() => runOne(row.slug)}
                    >
                      {isRunning ? "运行中…" : "运行"}
                    </Button>
                    {isJobRunning && lastJobId ? (
                      <Button variant="outline" size="sm" onClick={() => stop(lastJobId)}>
                        停止
                      </Button>
                    ) : null}
                    {canRetry && lastJobId ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={runningAll}
                        onClick={() => retry(row.slug, lastJobId)}
                      >
                        重试
                      </Button>
                    ) : null}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">{row.strategy}</p>

                {fresh ? (
                  <p className="text-xs text-muted-foreground">
                    本次：{STATUS_LABEL[fresh.status] ?? fresh.status} · 后缀 {fresh.totalTlds} · 更新{" "}
                    {fresh.updated} 行 · 尝试 {fresh.attempts} 次 · 耗时 {formatDuration(fresh.durationMs)}
                    {fresh.error ? <span className="text-destructive"> · {fresh.error}</span> : null}
                  </p>
                ) : row.lastJob ? (
                  <p className="text-xs text-muted-foreground">
                    上次运行：{formatTime(row.lastJob.startedAt)} · 耗时 {formatDuration(row.lastJob.durationMs)} ·
                    后缀 {row.lastJob.totalTlds} · 更新 {row.lastJob.pricesUpdated} 行
                    {row.lastJob.errorMessage ? (
                      <span className="text-destructive"> · {row.lastJob.errorMessage}</span>
                    ) : null}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
