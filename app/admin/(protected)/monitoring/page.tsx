import type { Metadata } from "next"
import { auditService } from "@/services/audit"
import { cacheService } from "@/services/cache"
import { metricsService } from "@/services/metrics"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const metadata: Metadata = {
  title: "监控中心 - DomainHub 管理后台",
}

export const dynamic = "force-dynamic"

function StatCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-2xl font-semibold text-foreground">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}

export default async function MonitoringPage() {
  const [crawlerSummary, adapterLatency, dbWrite, apiResponse, apiByRoute, auditEntries] = await Promise.all([
    metricsService.summarize("crawler.duration", 24),
    metricsService.summarizeByContext("crawler.adapter_latency", 24),
    metricsService.summarize("db.write_duration", 24),
    metricsService.summarize("api.response_time", 24),
    metricsService.summarizeByContext("api.response_time", 24),
    auditService.recent(30),
  ])
  const cache = cacheService.stats()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">监控中心</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          最近 24 小时的性能指标：采集耗时、数据库写入、API 响应与缓存命中率
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="采集平均耗时"
          value={crawlerSummary.count > 0 ? `${(crawlerSummary.avg / 1000).toFixed(1)}s` : "—"}
          hint={`最大 ${(crawlerSummary.max / 1000).toFixed(1)}s · ${crawlerSummary.count} 次`}
        />
        <StatCard
          title="数据库写入"
          value={dbWrite.count > 0 ? `${dbWrite.avg.toFixed(0)}ms` : "—"}
          hint={`最大 ${dbWrite.max.toFixed(0)}ms · ${dbWrite.count} 次`}
        />
        <StatCard
          title="API 平均响应"
          value={apiResponse.count > 0 ? `${apiResponse.avg.toFixed(0)}ms` : "—"}
          hint={`最大 ${apiResponse.max.toFixed(0)}ms · ${apiResponse.count} 次请求`}
        />
        <StatCard
          title="缓存命中率"
          value={`${cache.hitRatio}%`}
          hint={`${cache.hits} 命中 / ${cache.misses} 未命中 · ${cache.entries} 条缓存`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">各注册商 Adapter 耗时（24h）</CardTitle>
        </CardHeader>
        <CardContent>
          {adapterLatency.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无数据，运行一次采集后此处将展示各 Adapter 的耗时分布。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>注册商</TableHead>
                  <TableHead className="text-right">平均耗时</TableHead>
                  <TableHead className="text-right">最大耗时</TableHead>
                  <TableHead className="text-right">次数</TableHead>
                  <TableHead className="text-right">状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adapterLatency.map((row) => {
                  const avgMs = Number(row.avg)
                  const slow = avgMs > 30_000
                  return (
                    <TableRow key={row.context}>
                      <TableCell className="font-mono text-sm">{row.context || "-"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {avgMs >= 1000 ? `${(avgMs / 1000).toFixed(1)}s` : `${avgMs.toFixed(0)}ms`}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {Number(row.max) >= 1000
                          ? `${(Number(row.max) / 1000).toFixed(1)}s`
                          : `${Number(row.max).toFixed(0)}ms`}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{row.count}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={slow ? "destructive" : "secondary"}>{slow ? "偏慢" : "正常"}</Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">API 路由响应耗时（24h）</CardTitle>
        </CardHeader>
        <CardContent>
          {apiByRoute.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无数据，访问公开 API 后此处将展示各路由的响应耗时。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>路由</TableHead>
                  <TableHead className="text-right">平均</TableHead>
                  <TableHead className="text-right">最大</TableHead>
                  <TableHead className="text-right">请求数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiByRoute.map((row) => (
                  <TableRow key={row.context}>
                    <TableCell className="font-mono text-sm">{row.context || "-"}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{Number(row.avg).toFixed(0)}ms</TableCell>
                    <TableCell className="text-right font-mono text-sm">{Number(row.max).toFixed(0)}ms</TableCell>
                    <TableCell className="text-right font-mono text-sm">{row.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">管理操作审计日志（最近 30 条）</CardTitle>
        </CardHeader>
        <CardContent>
          {auditEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无审计记录。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>操作</TableHead>
                  <TableHead>详情</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {entry.createdAt.toLocaleString("zh-CN", { hour12: false })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={entry.action === "auth.login_failed" ? "destructive" : "secondary"}>
                        {entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{entry.detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
