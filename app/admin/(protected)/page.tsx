import Link from "next/link"
import {
  Store,
  Globe,
  DollarSign,
  Clock,
  CircleCheck,
  CircleX,
  TriangleAlert,
  Loader,
} from "lucide-react"
import { getAdminOverview, getRegistrarHealthRows } from "@/lib/db/admin-queries"
import { getRecentJobs } from "@/lib/db/queries"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CrawlAllButton } from "@/components/admin/crawl-buttons"
import { PageHeader, StatCard, MiniProgress, EmptyState } from "@/components/admin/ui"
import { formatDateTime, formatRelative } from "@/lib/format"

function jobStatusBadge(status: string) {
  if (status === "success") return <Badge>成功</Badge>
  if (status === "failed") return <Badge variant="destructive">失败</Badge>
  if (status === "running") return <Badge variant="secondary">进行中</Badge>
  return <Badge variant="secondary">{status}</Badge>
}

export default async function AdminDashboardPage() {
  const [overview, health, jobs] = await Promise.all([
    getAdminOverview(),
    getRegistrarHealthRows(),
    getRecentJobs(8),
  ])

  const hasFailures = overview.jobsFailed24h > 0
  const hasRunning = overview.jobsRunning > 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="概览"
        description="平台核心指标、采集健康状况与注册商覆盖一览。"
        actions={<CrawlAllButton />}
      />

      {/* 告警条 */}
      {hasFailures || hasRunning ? (
        <div className="flex flex-col gap-2">
          {hasFailures ? (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
              <TriangleAlert className="size-5 shrink-0 text-destructive" aria-hidden />
              <p className="text-sm text-foreground">
                最近 24 小时有 <span className="font-semibold text-destructive">{overview.jobsFailed24h}</span> 个采集任务失败。
              </p>
              <Link href="/admin/crawls?status=failed" className="ml-auto text-sm text-primary hover:underline">
                查看
              </Link>
            </div>
          ) : null}
          {hasRunning ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-accent px-4 py-3">
              <Loader className="size-5 shrink-0 animate-spin text-primary" aria-hidden />
              <p className="text-sm text-accent-foreground">
                当前有 <span className="font-semibold">{overview.jobsRunning}</span> 个采集任务正在运行。
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 关键指标 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="启用注册商"
          value={overview.registrarActive}
          hint={`共 ${overview.registrarTotal} 家`}
          icon={Store}
        />
        <StatCard
          label="有效后缀"
          value={overview.tldValid}
          hint={`热门 ${overview.tldPopular} · 收录 ${overview.tldTotal}`}
          icon={Globe}
        />
        <StatCard label="价格记录" value={overview.priceCount} icon={DollarSign} />
        <StatCard
          label="最近更新"
          value={<span className="text-lg">{formatRelative(overview.lastUpdated)}</span>}
          hint={overview.lastUpdated ? formatDateTime(overview.lastUpdated) : "暂无数据"}
          icon={Clock}
        />
      </div>

      {/* 24h 任务概况 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="24h 成功" value={overview.jobsSuccess24h} icon={CircleCheck} tone="positive" />
        <StatCard
          label="24h 失败"
          value={overview.jobsFailed24h}
          icon={CircleX}
          tone={overview.jobsFailed24h > 0 ? "danger" : "default"}
        />
        <StatCard label="进行中" value={overview.jobsRunning} icon={Loader} />
        <StatCard label="热门后缀" value={overview.tldPopular} icon={Globe} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 注册商健康 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">注册商覆盖与健康</CardTitle>
            <Link href="/admin/registrars" className="text-sm text-primary hover:underline">
              管理
            </Link>
          </CardHeader>
          <CardContent>
            {health.length === 0 ? (
              <EmptyState icon={Store} title="暂无注册商" />
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {health.map((r) => {
                  const h = (r.health as { score?: number } | null) ?? null
                  return (
                    <li key={r.id} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">{r.name}</span>
                          {!r.isActive ? (
                            <Badge variant="secondary" className="shrink-0 text-xs">
                              已禁用
                            </Badge>
                          ) : null}
                          {r.lastJobStatus === "failed" ? (
                            <CircleX className="size-3.5 shrink-0 text-destructive" aria-hidden />
                          ) : null}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <MiniProgress value={r.priceCount} max={r.validTldCount} className="max-w-32" />
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {r.priceCount} / {r.validTldCount}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        {typeof h?.score === "number" ? (
                          <Badge variant={h.score >= 80 ? "default" : h.score >= 50 ? "secondary" : "destructive"}>
                            {h.score}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">{formatRelative(r.lastJobAt)}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 最近任务 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">最近采集任务</CardTitle>
            <Link href="/admin/crawls" className="text-sm text-primary hover:underline">
              查看全部
            </Link>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <EmptyState icon={DollarSign} title="暂无采集任务" hint="点击右上角「全量采集」开始。" />
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {jobs.map((job) => (
                  <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div className="flex items-center gap-3">
                      {jobStatusBadge(job.status)}
                      <span className="text-sm font-medium text-foreground">{job.registrarName}</span>
                      <span className="text-sm text-muted-foreground">更新 {job.pricesUpdated} 条</span>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">{formatRelative(job.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
