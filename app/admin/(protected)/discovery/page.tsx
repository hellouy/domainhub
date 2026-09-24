import { db } from "@/lib/db"
import { registrarCandidates, registrars } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"
import { Compass, Clock, CheckCircle2, XCircle } from "lucide-react"
import { PageHeader, StatCard } from "@/components/admin/ui"
import { DiscoveryPanel } from "@/components/admin/discovery-panel"

export const dynamic = "force-dynamic"

export default async function AdminDiscoveryPage() {
  const rows = await db
    .select({
      id: registrarCandidates.id,
      name: registrarCandidates.name,
      website: registrarCandidates.website,
      pricePage: registrarCandidates.pricePage,
      source: registrarCandidates.source,
      confidence: registrarCandidates.confidence,
      status: registrarCandidates.status,
      evidence: registrarCandidates.evidence,
      createdAt: registrarCandidates.createdAt,
      promotedSlug: registrars.slug,
    })
    .from(registrarCandidates)
    .leftJoin(registrars, eq(registrarCandidates.promotedRegistrarId, registrars.id))
    .orderBy(desc(registrarCandidates.createdAt))

  const candidates = rows.map((r) => ({
    id: r.id,
    name: r.name,
    website: r.website,
    pricePage: r.pricePage,
    source: r.source,
    confidence: r.confidence,
    status: r.status,
    evidence: (r.evidence as Record<string, unknown> | null) ?? null,
    promotedSlug: r.promotedSlug ?? null,
    createdAt: r.createdAt.toISOString(),
  }))

  const pending = candidates.filter((c) => c.status === "pending").length
  const promoted = candidates.filter((c) => c.status === "promoted").length
  const rejected = candidates.filter((c) => c.status === "rejected").length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="注册商发现"
        description="输入注册商主站或价格页 URL，系统自动探测价格页并评估信心分。审核通过后提升为正式注册商，再生成采集规则。"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Compass} label="候选总数" value={candidates.length} />
        <StatCard icon={Clock} label="待审核" value={pending} tone="warning" />
        <StatCard icon={CheckCircle2} label="已提升" value={promoted} tone="positive" />
        <StatCard icon={XCircle} label="已拒绝" value={rejected} tone="danger" />
      </div>

      <DiscoveryPanel candidates={candidates} />
    </div>
  )
}
