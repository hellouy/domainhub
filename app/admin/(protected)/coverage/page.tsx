import { coverageService } from "@/services/coverage"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CoverageTables } from "@/components/admin/coverage-tables"

export const dynamic = "force-dynamic"

function formatTime(d: Date | null) {
  if (!d) return "—"
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(d)
}

export default async function CoveragePage() {
  const report = await coverageService.getReport()
  const { totals } = report

  const summary = [
    { label: "注册商总数", value: totals.registrars },
    { label: "真实数据源", value: totals.realRegistrars },
    { label: "种子数据源", value: totals.seedRegistrars },
    { label: "后缀总数", value: totals.totalTlds },
    { label: "价格记录", value: totals.totalPrices },
    { label: "平台覆盖率", value: `${totals.coveragePct}%` },
    { label: "缺失注册价", value: totals.missingRegister },
    { label: "缺失续费价", value: totals.missingRenew },
    { label: "缺失转入价", value: totals.missingTransfer },
    { label: "最近采集", value: formatTime(totals.lastCrawlAt) },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">覆盖率中心</h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          平台数据覆盖全景：注册商覆盖率、后缀覆盖率、缺失价格与健康分。
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

      <CoverageTables
        perRegistrar={report.perRegistrar.map((r) => ({
          ...r,
          lastCrawlAt: r.lastCrawlAt ? r.lastCrawlAt.toISOString() : null,
        }))}
        perTld={report.perTld}
        totalTlds={totals.totalTlds}
      />
    </div>
  )
}
