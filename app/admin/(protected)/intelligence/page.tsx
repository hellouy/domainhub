import { getPriceIntelligence, getSchedulerStats } from "@/lib/db/admin-queries"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const dynamic = "force-dynamic"

function formatTime(d: Date | null | undefined) {
  if (!d) return "—"
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(d)
}

export default async function IntelligencePage() {
  const [intel, stats] = await Promise.all([getPriceIntelligence(), getSchedulerStats()])

  const summary = [
    { label: "最便宜注册商（平均注册价）", value: intel.cheapest ? `${intel.cheapest.name} $${intel.cheapest.avgRegister}` : "—" },
    { label: "最贵注册商（平均注册价）", value: intel.mostExpensive ? `${intel.mostExpensive.name} $${intel.mostExpensive.avgRegister}` : "—" },
    { label: "平均注册价（USD）", value: `$${intel.overall.avgRegister ?? "—"}` },
    { label: "平均续费价（USD）", value: `$${intel.overall.avgRenew ?? "—"}` },
    { label: "平均转入价（USD）", value: `$${intel.overall.avgTransfer ?? "—"}` },
    { label: "价格记录总数", value: intel.overall.total },
    { label: "今日价格变动", value: intel.changesToday },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">价格情报</h1>
        <p className="mt-1 text-sm text-muted-foreground">基于当前价格与历史记录的统计分析（仅统计 USD 计价数据）</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {summary.map((item) => (
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">降价 Top 5</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {intel.drops.length === 0 && <p className="text-sm text-muted-foreground">暂无降价记录</p>}
            {intel.drops.map((m, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-foreground">.{m.tld}</span>
                  <span className="text-xs text-muted-foreground">{m.registrar_name}</span>
                </div>
                <p className="font-mono text-xs">
                  <span className="text-muted-foreground line-through">${m.old_price}</span>{" "}
                  <span className="text-foreground">${m.new_price}</span>{" "}
                  <span className="text-primary">({Number(m.diff) > 0 ? "+" : ""}{Number(m.diff).toFixed(2)})</span>
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">涨价 Top 5</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {intel.increases.length === 0 && <p className="text-sm text-muted-foreground">暂无涨价记录</p>}
            {intel.increases.map((m, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-foreground">.{m.tld}</span>
                  <span className="text-xs text-muted-foreground">{m.registrar_name}</span>
                </div>
                <p className="font-mono text-xs">
                  <span className="text-muted-foreground line-through">${m.old_price}</span>{" "}
                  <span className="text-foreground">${m.new_price}</span>{" "}
                  <span className="text-destructive">(+{Number(m.diff).toFixed(2)})</span>
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">注册商平均注册价排名</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {intel.registrarAverages.map((r, i) => (
            <div key={r.registrarId} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="w-6 font-mono text-xs text-muted-foreground">#{i + 1}</span>
                <span className="text-sm text-foreground">{r.name}</span>
                <Badge variant="outline">{r.count} 个后缀</Badge>
              </div>
              <span className="font-mono text-sm font-semibold text-foreground">${r.avgRegister}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">最新采集</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {stats.history.slice(0, 8).map((job) => (
            <div key={job.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">#{job.id}</span>
                <span className="text-sm text-foreground">{job.registrarName}</span>
                <Badge variant={job.status === "failed" ? "destructive" : "secondary"}>{job.status}</Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatTime(job.createdAt)} · 更新 {job.pricesUpdated} 条
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
