import { db } from "@/lib/db"
import { crawlJobs, registrars } from "@/lib/db/schema"
import { crawlerRunner } from "@/services/crawler"
import { desc, eq, sql } from "drizzle-orm"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata = { title: "健康检查 - DomainHub 后台" }

export const dynamic = "force-dynamic"

type HealthLevel = "ok" | "warn" | "error"

function HealthBadge({ level }: { level: HealthLevel }) {
  if (level === "ok") return <Badge>正常</Badge>
  if (level === "warn") return <Badge variant="secondary">注意</Badge>
  return <Badge variant="destructive">异常</Badge>
}

export default async function HealthPage() {
  // 1. 数据库连通性
  let dbLevel: HealthLevel = "ok"
  let dbDetail = ""
  const dbStart = Date.now()
  try {
    await db.execute(sql`SELECT 1`)
    dbDetail = `连接正常 · 延迟 ${Date.now() - dbStart}ms`
  } catch (err) {
    dbLevel = "error"
    dbDetail = `连接失败：${err instanceof Error ? err.message : String(err)}`
  }

  // 2. Adapter 注册情况
  const adapters = crawlerRunner.listAdapters()
  const activeRegistrars =
    dbLevel === "ok"
      ? await db.select().from(registrars).where(eq(registrars.isActive, true))
      : []
  const missingAdapters = activeRegistrars.filter((r) => !adapters.some((a) => a.slug === r.slug))
  const adapterLevel: HealthLevel = missingAdapters.length > 0 ? "warn" : "ok"
  const adapterDetail =
    missingAdapters.length > 0
      ? `${adapters.length} 个已注册 · ${missingAdapters.length} 个启用中的注册商缺少 Adapter（${missingAdapters.map((r) => r.slug).join("、")}）`
      : `${adapters.length} 个已注册，覆盖全部启用注册商`

  // 3. 采集器状态（是否有卡死的运行中任务：running 超过 10 分钟视为异常）
  const runningJobs =
    dbLevel === "ok" ? await db.select().from(crawlJobs).where(eq(crawlJobs.status, "running")) : []
  const staleJobs = runningJobs.filter(
    (j) => j.startedAt && Date.now() - j.startedAt.getTime() > 10 * 60 * 1000,
  )
  const crawlerLevel: HealthLevel = staleJobs.length > 0 ? "warn" : "ok"
  const crawlerDetail =
    runningJobs.length === 0
      ? "空闲，无进行中任务"
      : staleJobs.length > 0
        ? `${runningJobs.length} 个进行中任务，其中 ${staleJobs.length} 个已超过 10 分钟（可能已中断，建议停止后重试）`
        : `${runningJobs.length} 个任务进行中`

  // 4. 最近一次采集
  const [lastJob] =
    dbLevel === "ok"
      ? await db
          .select({
            id: crawlJobs.id,
            status: crawlJobs.status,
            finishedAt: crawlJobs.finishedAt,
            createdAt: crawlJobs.createdAt,
            pricesUpdated: crawlJobs.pricesUpdated,
            registrarName: registrars.name,
          })
          .from(crawlJobs)
          .leftJoin(registrars, eq(crawlJobs.registrarId, registrars.id))
          .orderBy(desc(crawlJobs.id))
          .limit(1)
      : []
  const lastCrawlAge = lastJob?.createdAt ? Date.now() - lastJob.createdAt.getTime() : null
  const lastCrawlLevel: HealthLevel =
    lastCrawlAge === null ? "warn" : lastCrawlAge > 7 * 24 * 60 * 60 * 1000 ? "warn" : "ok"
  const lastCrawlDetail = lastJob
    ? `#${lastJob.id} ${lastJob.registrarName ?? ""} · ${lastJob.createdAt.toLocaleString("zh-CN", { hour12: false })} · ${lastJob.status} · 更新 ${lastJob.pricesUpdated} 行`
    : "尚未运行过任何采集任务"

  // 5. 最近 24 小时失败任务
  const failedJobs =
    dbLevel === "ok"
      ? (
          await db
            .select({
              id: crawlJobs.id,
              errorMessage: crawlJobs.errorMessage,
              createdAt: crawlJobs.createdAt,
              registrarName: registrars.name,
            })
            .from(crawlJobs)
            .leftJoin(registrars, eq(crawlJobs.registrarId, registrars.id))
            .where(eq(crawlJobs.status, "failed"))
            .orderBy(desc(crawlJobs.id))
            .limit(50)
        ).filter((j) => Date.now() - j.createdAt.getTime() < 24 * 60 * 60 * 1000)
      : []
  const failedLevel: HealthLevel =
    failedJobs.length === 0 ? "ok" : failedJobs.length >= 5 ? "error" : "warn"

  const checks: { name: string; level: HealthLevel; detail: string }[] = [
    { name: "数据库", level: dbLevel, detail: dbDetail },
    { name: "采集器", level: crawlerLevel, detail: crawlerDetail },
    { name: "Adapter", level: adapterLevel, detail: adapterDetail },
    { name: "最近采集", level: lastCrawlLevel, detail: lastCrawlDetail },
    {
      name: "失败任务（24h）",
      level: failedLevel,
      detail: failedJobs.length === 0 ? "无失败任务" : `${failedJobs.length} 个失败任务`,
    },
  ]

  const overall: HealthLevel = checks.some((c) => c.level === "error")
    ? "error"
    : checks.some((c) => c.level === "warn")
      ? "warn"
      : "ok"

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-foreground">健康检查</h1>
        <HealthBadge level={overall} />
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        {checks.map((check) => (
          <Card key={check.name}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm">{check.name}</CardTitle>
              <HealthBadge level={check.level} />
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">{check.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {failedJobs.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">失败任务明细（最近 24 小时）</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {failedJobs.map((job) => (
                <li key={job.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">#{job.id}</span>
                  <span className="text-foreground">{job.registrarName}</span>
                  <span className="text-xs text-muted-foreground">
                    {job.createdAt.toLocaleString("zh-CN", { hour12: false })}
                  </span>
                  <span className="text-xs text-destructive">{job.errorMessage}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
