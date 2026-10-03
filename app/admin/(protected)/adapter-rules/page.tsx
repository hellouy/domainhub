import { FileCode2, CheckCircle2, FlaskConical, Ban } from "lucide-react"
import { PageHeader, StatCard } from "@/components/admin/ui"
import { AdapterRulesTable } from "@/components/admin/adapter-rules-table"
import { listAdapterRulesData } from "@/app/actions/discovery"

export const dynamic = "force-dynamic"

export default async function AdminAdapterRulesPage() {
  const rows = await listAdapterRulesData()

  const data = rows.map((r) => ({
    id: r.id,
    registrarId: r.registrarId,
    slug: r.slug ?? "(未知)",
    registrarName: r.registrarName ?? "(未知)",
    isActive: r.isActive ?? false,
    config: (r.config as Record<string, unknown>) ?? {},
    status: r.status,
    modelUsed: r.modelUsed,
    verification: (r.verification as Record<string, unknown> | null) ?? null,
    trigger: r.trigger,
    createdAt: r.createdAt.toISOString(),
  }))

  const active = data.filter((r) => r.status === "active").length
  const candidate = data.filter((r) => r.status === "candidate").length
  const rejected = data.filter((r) => r.status === "rejected").length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="适配器规则"
        description="AI 修复代理生成的声明式采集规则。规则驱动的注册商无需编写 TypeScript 适配器即可采集；激活规则后启用采集即可生效。"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={FileCode2} label="规则总数" value={data.length} />
        <StatCard icon={CheckCircle2} label="生效中" value={active} tone="positive" />
        <StatCard icon={FlaskConical} label="候选" value={candidate} tone="warning" />
        <StatCard icon={Ban} label="已禁用/拒绝" value={rejected} tone="danger" />
      </div>

      <AdapterRulesTable rules={data} />
    </div>
  )
}
