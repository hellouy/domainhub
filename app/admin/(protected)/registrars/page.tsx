import { db } from "@/lib/db"
import { registrars } from "@/lib/db/schema"
import { asc } from "drizzle-orm"
import { RegistrarAdminTable } from "@/components/admin/registrar-admin-table"

export default async function AdminRegistrarsPage() {
  const rows = await db.select().from(registrars).orderBy(asc(registrars.name))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">注册商管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">启用/禁用注册商、编辑信息、手动触发价格采集。</p>
      </div>
      <RegistrarAdminTable registrars={rows} />
    </div>
  )
}
