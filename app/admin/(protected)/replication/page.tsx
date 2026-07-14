import { Database, DatabaseBackup, CircleCheck, CircleX, TriangleAlert } from "lucide-react"
import { getReplicationStatus } from "@/services/replication/sync"
import { dbProvider, replicaProvider, hasReplica } from "@/lib/db"
import { PageHeader, StatCard, EmptyState } from "@/components/admin/ui"
import { ReplicationSyncButton } from "@/components/admin/replication-sync-button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const dynamic = "force-dynamic"

const PROVIDER_LABEL: Record<string, string> = {
  neon: "Neon",
  supabase: "Supabase",
  postgres: "PostgreSQL",
  unknown: "未知",
}

function formatTime(iso: string | null): string {
  if (!iso) return "从未同步"
  const d = new Date(iso)
  return d.toLocaleString("zh-CN", { hour12: false })
}

export default async function AdminReplicationPage() {
  const status = await getReplicationStatus()

  // 判断整体一致性：任一表主备行数不一致则标记为待同步
  const drifted = status.counts.filter(
    (c) => c.replica !== null && c.replica !== c.primary,
  )
  const unreachable = status.configured && status.counts.some((c) => c.replica === null)
  const inSync = status.configured && !unreachable && drifted.length === 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="数据容灾"
        description="主库 Neon 负责读写，备库 Supabase 作为热备只读副本。数据单向 Neon → Supabase 同步；主库不可用时前台与 API 读请求自动切换到备库。"
        actions={status.configured ? <ReplicationSyncButton /> : undefined}
      />

      {!status.configured ? (
        <Card>
          <CardContent className="p-4">
            <EmptyState
              icon={DatabaseBackup}
              title="尚未配置备库"
              hint="设置环境变量 REPLICA_DATABASE_URL 指向 Supabase 的 Postgres 连接串后，即可启用热备与自动故障切换。详见 docs/db-portability.md。"
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={Database}
              label="主库（读写）"
              value={PROVIDER_LABEL[dbProvider] ?? dbProvider}
              hint="Neon · 负责采集写入与读取"
            />
            <StatCard
              icon={DatabaseBackup}
              label="备库（只读）"
              value={PROVIDER_LABEL[replicaProvider] ?? replicaProvider}
              hint="Supabase · 故障时接管读请求"
              tone={hasReplica ? "positive" : "default"}
            />
            <StatCard
              icon={inSync ? CircleCheck : TriangleAlert}
              label="同步状态"
              value={inSync ? "已同步" : unreachable ? "备库不可达" : "待同步"}
              tone={inSync ? "positive" : "warning"}
              hint={drifted.length > 0 ? `${drifted.length} 张表有差异` : undefined}
            />
            <StatCard
              icon={CircleCheck}
              label="最近同步"
              value={<span className="text-sm">{formatTime(status.lastSyncAt)}</span>}
              hint={
                status.lastResult?.durationMs != null
                  ? `用时 ${status.lastResult.durationMs}ms`
                  : undefined
              }
            />
          </div>

          {status.lastError ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div>
                <p className="font-medium">最近一次同步失败</p>
                <p className="mt-0.5 text-destructive/90">{status.lastError}</p>
              </div>
            </div>
          ) : null}

          <Card>
            <CardContent className="p-0">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">各表主备行数对比</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  凭证 / 队列 / 日志等运维表不参与复制。
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>数据表</TableHead>
                    <TableHead className="text-right">主库 Neon</TableHead>
                    <TableHead className="text-right">备库 Supabase</TableHead>
                    <TableHead className="text-right">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {status.counts.map((c) => {
                    const ok = c.replica !== null && c.replica === c.primary
                    return (
                      <TableRow key={c.table}>
                        <TableCell>
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                            {c.table}
                          </code>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {c.primary.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {c.replica === null ? "—" : c.replica.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.replica === null ? (
                            <Badge variant="outline" className="text-[10px]">
                              不可达
                            </Badge>
                          ) : ok ? (
                            <Badge className="bg-primary/15 text-primary text-[10px] hover:bg-primary/15">
                              一致
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]">
                              差 {Math.abs(c.primary - (c.replica ?? 0)).toLocaleString()}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
