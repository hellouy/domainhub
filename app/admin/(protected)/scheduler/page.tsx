import { getSchedulerStats } from "@/lib/db/admin-queries"
import { storageService } from "@/services/storage"
import { crawlerRunner } from "@/services/crawler"
import { SchedulerPanel } from "@/components/admin/scheduler-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const dynamic = "force-dynamic"

function formatTime(d: Date | null | undefined) {
  if (!d) return "—"
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(d)
}

function statusBadge(status: string) {
  switch (status) {
    case "success":
      return <Badge className="bg-primary text-primary-foreground">成功</Badge>
    case "warning":
      return <Badge variant="secondary">警告</Badge>
    case "failed":
      return <Badge variant="destructive">失败</Badge>
    case "cancelled":
      return <Badge variant="outline">已取消</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export default async function SchedulerPage() {
  const [settings, stats, adapters] = await Promise.all([
    storageService.getSchedulerSettings(),
    getSchedulerStats(),
    Promise.resolve(crawlerRunner.listAdapters()),
  ])

  // 下次运行时间（启用时）
  let nextRun: Date | null = null
  if (settings?.enabled) {
    const now = new Date()
    nextRun = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), settings.runHourUtc))
    if (nextRun <= now) nextRun = new Date(nextRun.getTime() + 24 * 60 * 60 * 1000)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">调度中心</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          手动运行、失败重试与每日定时采集（通过 /api/cron/crawl 每小时检查一次）
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "定时状态", value: settings?.enabled ? "已启用" : "已关闭" },
          { label: "下次运行", value: formatTime(nextRun) },
          { label: "上次定时运行", value: formatTime(settings?.lastRunAt) },
          { label: "平均任务耗时", value: `${(stats.avgDurationMs / 1000).toFixed(1)}s` },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-normal text-muted-foreground">{item.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-lg font-semibold text-foreground">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <SchedulerPanel
        adapters={adapters.map((a) => ({ slug: a.slug, name: a.name, strategy: a.strategy }))}
        enabled={settings?.enabled ?? false}
        runHourUtc={settings?.runHourUtc ?? 2}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">运行历史（最近 30 条）</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {stats.history.length === 0 && <p className="text-sm text-muted-foreground">暂无任务记录</p>}
          {stats.history.map((job) => (
            <div key={job.id} className="flex flex-col gap-1 rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-foreground">#{job.id}</span>
                <span className="text-sm text-foreground">{job.registrarName}</span>
                {statusBadge(job.status)}
                <Badge variant="outline">{job.trigger}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatTime(job.createdAt)} · 后缀 {job.totalTlds} · 新增 {job.rowsInserted} · 更新 {job.rowsUpdated} ·
                跳过 {job.rowsSkipped} · 拒绝 {job.rowsRejected} · 重试 {job.retries}
                {job.startedAt && job.finishedAt
                  ? ` · ${((job.finishedAt.getTime() - job.startedAt.getTime()) / 1000).toFixed(1)}s`
                  : ""}
              </p>
              {job.errorMessage && (
                <p className="font-mono text-xs text-destructive">{job.errorMessage}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
