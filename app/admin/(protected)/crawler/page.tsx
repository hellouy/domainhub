import { db } from "@/lib/db"
import { crawlJobs, registrars } from "@/lib/db/schema"
import { crawlerRunner } from "@/services/crawler"
import { desc, inArray } from "drizzle-orm"
import { CrawlerPanel, type AdapterRow } from "@/components/admin/crawler-panel"

export const metadata = { title: "采集引擎 - DomainHub 后台" }

export const dynamic = "force-dynamic"

export default async function CrawlerEnginePage() {
  const adapters = crawlerRunner.listAdapters()
  const allRegistrars = await db.select().from(registrars)
  const registrarBySlug = new Map(allRegistrars.map((r) => [r.slug, r]))

  const ids = allRegistrars.map((r) => r.id)
  const recentJobs = ids.length
    ? await db
        .select()
        .from(crawlJobs)
        .where(inArray(crawlJobs.registrarId, ids))
        .orderBy(desc(crawlJobs.id))
        .limit(200)
    : []

  // 每个注册商的最近一次任务
  const latestByRegistrar = new Map<number, (typeof recentJobs)[number]>()
  for (const job of recentJobs) {
    if (!latestByRegistrar.has(job.registrarId)) latestByRegistrar.set(job.registrarId, job)
  }

  const rows: AdapterRow[] = adapters.map((a) => {
    const registrar = registrarBySlug.get(a.slug)
    const job = registrar ? latestByRegistrar.get(registrar.id) : undefined
    return {
      slug: a.slug,
      name: a.name,
      strategy: a.strategy,
      isActive: registrar?.isActive ?? false,
      lastJob: job
        ? {
            id: job.id,
            status: job.status,
            startedAt: job.startedAt?.toISOString() ?? null,
            finishedAt: job.finishedAt?.toISOString() ?? null,
            durationMs:
              job.startedAt && job.finishedAt
                ? job.finishedAt.getTime() - job.startedAt.getTime()
                : null,
            totalTlds: job.totalTlds,
            pricesUpdated: job.pricesUpdated,
            errorMessage: job.errorMessage,
          }
        : null,
    }
  })

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">采集引擎</h1>
        <p className="text-sm text-muted-foreground">
          可用 Adapter：{rows.length} 个 · 运行、停止、重试采集任务并查看最近一次运行统计
        </p>
      </header>
      <CrawlerPanel rows={rows} />
    </div>
  )
}
