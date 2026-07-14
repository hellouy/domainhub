import { db } from "@/lib/db"
import { registrars } from "@/lib/db/schema"
import { asc } from "drizzle-orm"
import { Store, CheckCircle2, DollarSign, Activity } from "lucide-react"
import { getRegistrarHealthRows } from "@/lib/db/admin-queries"
import { RegistrarAdminTable } from "@/components/admin/registrar-admin-table"
import { PageHeader, StatCard } from "@/components/admin/ui"

export default async function AdminRegistrarsPage() {
  const [rows, healthRows] = await Promise.all([
    db.select().from(registrars).orderBy(asc(registrars.name)),
    getRegistrarHealthRows(),
  ])

  // 用 slug 关联覆盖/价格数据
  const healthBySlug = new Map(healthRows.map((h) => [h.slug, h]))

  const tableRows = rows.map((r) => {
    const h = healthBySlug.get(r.slug)
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      website: r.website,
      description: r.description,
      isActive: r.isActive,
      health: (r.health as Record<string, unknown> | null) ?? null,
      adapterVersion: r.adapterVersion,
      owner: r.owner,
      priceCount: h?.priceCount ?? 0,
      coverage: h?.coverage ?? 0,
      lastPriceAt: h?.lastPriceAt ?? null,
      lastJobStatus: h?.lastJobStatus ?? null,
    }
  })

  const activeCount = rows.filter((r) => r.isActive).length
  const totalPrices = healthRows.reduce((sum, h) => sum + h.priceCount, 0)
  const withData = healthRows.filter((h) => h.priceCount > 0).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="注册商管理"
        description="启用/禁用注册商、编辑信息、手动触发价格采集，并查看适配器健康状态。"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Store} label="注册商总数" value={rows.length} />
        <StatCard icon={CheckCircle2} label="已启用" value={activeCount} tone="positive" />
        <StatCard icon={Activity} label="有价格数据" value={`${withData}/${rows.length}`} />
        <StatCard icon={DollarSign} label="价格记录总数" value={totalPrices.toLocaleString()} />
      </div>

      <RegistrarAdminTable registrars={tableRows} />
    </div>
  )
}
