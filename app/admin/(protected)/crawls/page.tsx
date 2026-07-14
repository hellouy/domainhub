import Link from "next/link"
import { eq } from "drizzle-orm"
import { Radio, CircleCheck, CircleX, Loader } from "lucide-react"
import { getJobsFiltered, getJobStats, getRegistrarOptions } from "@/lib/db/admin-queries"
import { getJobLogs } from "@/lib/crawler/runner"
import { db } from "@/lib/db"
import { registrars } from "@/lib/db/schema"
import { getBackfillState } from "@/services/crawl/backfill"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BackfillControl, type BackfillState } from "@/components/admin/backfill-control"
import { PageHeader, StatCard, EmptyState } from "@/components/admin/ui"
import { formatDateTime, formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"

function statusBadge(status: string) {
  if (status === "success") return <Badge>成功</Badge>
  if (status === "failed") return <Badge variant="destructive">失败</Badge>
  if (status === "running") return <Badge variant="secondary">进行中</Badge>
  return <Badge variant="secondary">{status}</Badge>
}

function triggerLabel(trigger: string) {
  const map: Record<string, string> = { manual: "手动", cron: "定时", backfill: "回填", api: "接口" }
  return map[trigger] ?? trigger
}

function MetricsPanel({ metrics }: { metrics: Record<string, unknown> | null }) {
  if (!metrics || typeof metrics !== "object") return null
  const num = (k: string) => (typeof metrics[k] === "number" ? (metrics[k] as number) : undefined)
  const ms = (k: string) => {
    const v = num(k)
    return v == null ? null : v < 1000 ? `${v}ms` : `${(v / 1000).toFixed(1)}s`
  }
  const items: { label: string; value: string | number | null }[] = [
    { label: "总耗时", value: ms("totalMs") },
    { label: "下载", value: ms("downloadMs") },
    { label: "解析", value: ms("parsingMs") },
    { label: "入库", value: ms("databaseMs") },
    { label: "新增", value: num("inserted") ?? null },
    { label: "更新", value: num("updated") ?? null },
    { label: "跳过", value: num("skipped") ?? null },
    { label: "拒绝", value: num("rejected") ?? null },
    { label: "重试", value: num("retries") ?? null },
    {
      label: "覆盖率",
      value: typeof metrics.coverage === "number" ? `${Math.round((metrics.coverage as number) * 100)}%` : null,
    },
  ].filter((i) => i.value != null)
  if (items.length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {items.map((i) => (
        <div key={i.label} className="rounded-md border border-border bg-background px-2.5 py-2">
          <p className="text-xs text-muted-foreground">{i.label}</p>
          <p className="font-mono text-sm font-medium text-foreground">{i.value}</p>
        </div>
      ))}
    </div>
  )
}

export default async function AdminCrawlsPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string; status?: string; registrar?: string }>
}) {
  const sp = await searchParams
  const statusFilter = sp.status ?? "all"
  const registrarFilter = sp.registrar ? Number(sp.registrar) : undefined

  const [stats, jobs, registrarOptions, netimRow] = await Promise.all([
    getJobStats(),
    getJobsFiltered({ status: statusFilter, registrarId: registrarFilter, limit: 40 }),
    getRegistrarOptions(),
    db.select().from(registrars).where(eq(registrars.slug, "netim")).limit(1),
  ])

  const selectedJobId = sp.job ? Number(sp.job) : jobs[0]?.id
  const logs = selectedJobId ? await getJobLogs(selectedJobId) : []
  const selectedJob = jobs.find((j) => j.id === selectedJobId)

  const netim = netimRow[0]
  const backfillRow = netim ? await getBackfillState(netim.id) : null
  const backfillState: BackfillState | null = backfillRow
    ? {
        status: backfillRow.status,
        cursor: backfillRow.cursor,
        batchSize: backfillRow.batchSize,
        total: backfillRow.total,
        batchesDone: backfillRow.batchesDone,
        pricesUpdated: backfillRow.pricesUpdated,
        lastBatchAt: backfillRow.lastBatchAt?.toISOString() ?? null,
        startedAt: backfillRow.startedAt?.toISOString() ?? null,
      }
    : null

  const statusTabs = [
    { key: "all", label: "全部" },
    { key: "success", label: "成功" },
    { key: "failed", label: "失败" },
    { key: "running", label: "进行中" },
  ]
  const buildHref = (opts: { status?: string; registrar?: number | undefined; job?: number }) => {
    const params = new URLSearchParams()
    const s = opts.status ?? statusFilter
    if (s && s !== "all") params.set("status", s)
    const reg = opts.registrar !== undefined ? opts.registrar : registrarFilter
    if (reg) params.set("registrar", String(reg))
    if (opts.job) params.set("job", String(opts.job))
    const qs = params.toString()
    return `/admin/crawls${qs ? `?${qs}` : ""}`
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="采集任务" description="查看采集任务历史、分阶段指标与详细日志，并管理分批回填。" />

      {/* 任务统计 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="任务总数" value={stats.total} icon={Radio} />
        <StatCard label="成功" value={stats.success} icon={CircleCheck} tone="positive" />
        <StatCard label="失败" value={stats.failed} icon={CircleX} tone={stats.failed > 0 ? "danger" : "default"} />
        <StatCard label="进行中" value={stats.running} icon={Loader} />
      </div>

      {/* 分批回填 */}
      {netim ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">分批全量回填 · {netim.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <BackfillControl registrarId={netim.id} registrarName={netim.name} state={backfillState} />
          </CardContent>
        </Card>
      ) : null}

      {/* 过滤器 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1">
          {statusTabs.map((t) => (
            <Link
              key={t.key}
              href={buildHref({ status: t.key })}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                statusFilter === t.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <form method="get" className="flex items-center gap-2">
          {statusFilter !== "all" ? <input type="hidden" name="status" value={statusFilter} /> : null}
          <select
            name="registrar"
            defaultValue={registrarFilter ? String(registrarFilter) : ""}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="">全部注册商</option>
            {registrarOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline" size="sm">
            筛选
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 任务历史 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">任务历史</CardTitle>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <EmptyState icon={Radio} title="暂无采集任务" />
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {jobs.map((job) => (
                  <li key={job.id}>
                    <Link
                      href={buildHref({ job: job.id })}
                      className={cn(
                        "flex flex-wrap items-center justify-between gap-2 px-2 py-3 hover:bg-accent",
                        job.id === selectedJobId ? "bg-accent" : "",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {statusBadge(job.status)}
                        <span className="text-sm font-medium text-foreground">#{job.id}</span>
                        <span className="text-sm text-foreground">{job.registrarName}</span>
                        <Badge variant="secondary" className="text-xs">
                          {triggerLabel(job.trigger)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          后缀 {job.totalTlds} · 更新 {job.pricesUpdated} 条
                        </span>
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">{formatRelative(job.createdAt)}</span>
                    </Link>
                    {job.errorMessage ? (
                      <p className="px-2 pb-2 text-xs text-destructive">{job.errorMessage}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 任务详情 + 日志 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedJobId ? `任务 #${selectedJobId} 详情` : "任务详情"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {selectedJob ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {statusBadge(selectedJob.status)}
                  <span className="text-foreground">{selectedJob.registrarName}</span>
                  {selectedJob.strategy ? (
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                      {selectedJob.strategy}
                    </code>
                  ) : null}
                  <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {formatDateTime(selectedJob.createdAt)}
                  </span>
                </div>
                <MetricsPanel metrics={selectedJob.metrics as Record<string, unknown> | null} />
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">日志</p>
              {logs.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">暂无日志。</p>
              ) : (
                <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto font-mono text-xs">
                  {logs.map((log) => (
                    <li key={log.id} className="flex items-start gap-2">
                      <span
                        className={
                          log.level === "error"
                            ? "text-destructive"
                            : log.level === "warn"
                              ? "text-primary"
                              : "text-muted-foreground"
                        }
                      >
                        [{log.level.toUpperCase()}]
                      </span>
                      <span className="text-foreground">{log.message}</span>
                      <span className="ml-auto shrink-0 text-muted-foreground">{formatRelative(log.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
