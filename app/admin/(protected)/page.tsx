import Link from "next/link"
import { getStats, getRecentJobs } from "@/lib/db/queries"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CrawlAllButton } from "@/components/admin/crawl-buttons"
import { formatDateTime } from "@/lib/format"

export default async function AdminDashboardPage() {
  const [stats, jobs] = await Promise.all([getStats(), getRecentJobs(8)])

  const items = [
    { label: "启用注册商", value: stats.registrarCount },
    { label: "收录后缀", value: stats.tldCount },
    { label: "价格记录", value: stats.priceCount },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground">概览</h1>
        <CrawlAllButton />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-3xl font-bold text-foreground">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">最近采集任务</CardTitle>
          <Link href="/admin/crawls" className="text-sm text-primary hover:underline">
            查看全部
          </Link>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">暂无采集任务，点击右上角「全量采集」开始。</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {jobs.map((job) => (
                <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="flex items-center gap-3">
                    <Badge variant={job.status === "success" ? "default" : job.status === "failed" ? "destructive" : "secondary"}>
                      {job.status === "success" ? "成功" : job.status === "failed" ? "失败" : "进行中"}
                    </Badge>
                    <span className="text-sm font-medium text-foreground">{job.registrarName}</span>
                    <span className="text-sm text-muted-foreground">更新 {job.pricesUpdated} 条</span>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{formatDateTime(job.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
