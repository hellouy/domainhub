import { getDataQuality } from "@/lib/db/admin-queries"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const dynamic = "force-dynamic"

function statusBadge(status: string | null) {
  switch (status) {
    case "success":
      return <Badge className="bg-primary text-primary-foreground">健康</Badge>
    case "warning":
      return <Badge variant="secondary">警告</Badge>
    case "failed":
      return <Badge variant="destructive">失败</Badge>
    case "cancelled":
      return <Badge variant="outline">已取消</Badge>
    case "running":
    case "pending":
      return <Badge variant="secondary">进行中</Badge>
    default:
      return <Badge variant="outline">未采集</Badge>
  }
}

function formatTime(d: Date | null) {
  if (!d) return "—"
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(d)
}

export default async function DataQualityPage() {
  const { totals, perRegistrar } = await getDataQuality()

  const summary = [
    { label: "注册 Adapter", value: totals.adapters },
    { label: "健康", value: totals.healthy },
    { label: "警告", value: totals.warning },
    { label: "失败", value: totals.failed },
    { label: "后缀总数", value: totals.totalTlds },
    { label: "价格记录", value: totals.totalPrices },
    { label: "缺失注册价", value: totals.missingPrices },
    { label: "非法价格", value: totals.invalidPrices },
    { label: "重复记录", value: totals.duplicatePrices },
    { label: "整体覆盖率", value: `${totals.coveragePct}%` },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">数据质量中心</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          最近成功采集：{formatTime(totals.lastSuccessAt)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {summary.map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-normal text-muted-foreground">{item.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-xl font-semibold text-foreground">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">各注册商数据质量</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {perRegistrar.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">{r.name}</span>
                {statusBadge(r.latestStatus)}
                {!r.isActive && <Badge variant="outline">已停用</Badge>}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  覆盖率 <span className="font-mono text-foreground">{r.coveragePct}%</span>（{r.priceCount}/
                  {totals.totalTlds}）
                </span>
                <span>最近任务：{formatTime(r.latestJobAt)}</span>
                <span>最近成功：{formatTime(r.lastSuccessAt)}</span>
              </div>
              {/* 覆盖率进度条 */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-primary" style={{ width: `${r.coveragePct}%` }} />
              </div>
              {r.latestError && (
                <p className="rounded bg-destructive/10 px-2 py-1 font-mono text-xs text-destructive">
                  {r.latestError}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
