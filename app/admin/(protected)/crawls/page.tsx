import { eq } from "drizzle-orm"
import { getRecentJobs } from "@/lib/db/queries"
import { getJobLogs } from "@/lib/crawler/runner"
import { db } from "@/lib/db"
import { registrars } from "@/lib/db/schema"
import { getBackfillState } from "@/services/crawl/backfill"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BackfillControl, type BackfillState } from "@/components/admin/backfill-control"
import { formatDateTime } from "@/lib/format"

export default async function AdminCrawlsPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>
}) {
  const { job: jobParam } = await searchParams
  const jobs = await getRecentJobs(30)
  const selectedJobId = jobParam ? Number(jobParam) : jobs[0]?.id
  const logs = selectedJobId ? await getJobLogs(selectedJobId) : []

  // Netim 分批回填状态（逐 TLD 拉取型注册商，支持分批全量回填）
  const [netim] = await db.select().from(registrars).where(eq(registrars.slug, "netim")).limit(1)
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">采集任务</h1>
        <p className="mt-1 text-sm text-muted-foreground">查看采集任务历史与详细日志。</p>
      </div>

      {netim ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">分批全量回填</CardTitle>
          </CardHeader>
          <CardContent>
            <BackfillControl registrarId={netim.id} registrarName={netim.name} state={backfillState} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">任务历史</CardTitle>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">暂无采集任务。</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {jobs.map((job) => (
                  <li key={job.id}>
                    <a
                      href={`/admin/crawls?job=${job.id}`}
                      className={`flex flex-wrap items-center justify-between gap-2 px-2 py-3 hover:bg-accent ${
                        job.id === selectedJobId ? "bg-accent" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            job.status === "success" ? "default" : job.status === "failed" ? "destructive" : "secondary"
                          }
                        >
                          {job.status === "success" ? "成功" : job.status === "failed" ? "失败" : "进行中"}
                        </Badge>
                        <span className="text-sm font-medium text-foreground">#{job.id}</span>
                        <span className="text-sm text-foreground">{job.registrarName}</span>
                        <span className="text-xs text-muted-foreground">
                          后缀 {job.totalTlds} · 更新 {job.pricesUpdated} 条
                          {job.startedAt && job.finishedAt
                            ? ` · ${((job.finishedAt.getTime() - job.startedAt.getTime()) / 1000).toFixed(1)}s`
                            : ""}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">{formatDateTime(job.createdAt)}</span>
                    </a>
                    {job.errorMessage ? (
                      <p className="px-2 pb-2 text-xs text-destructive">{job.errorMessage}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedJobId ? `任务 #${selectedJobId} 日志` : "任务日志"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">暂无日志。</p>
            ) : (
              <ul className="flex flex-col gap-2 font-mono text-xs">
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
                    <span className="ml-auto shrink-0 text-muted-foreground">{formatDateTime(log.createdAt)}</span>
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
