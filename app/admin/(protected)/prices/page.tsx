import Link from "next/link"
import { Search } from "lucide-react"
import { searchPrices, getRegistrarOptions } from "@/lib/db/admin-queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader, EmptyState } from "@/components/admin/ui"
import { PriceTable, type PriceRow } from "@/components/admin/price-table"

export default async function AdminPricesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; registrar?: string; page?: string }>
}) {
  const sp = await searchParams
  const q = sp.q?.trim() ?? ""
  const registrarId = sp.registrar ? Number(sp.registrar) : undefined
  const page = sp.page ? Math.max(1, Number(sp.page)) : 1

  const [{ rows, total, pageSize }, registrarOptions] = await Promise.all([
    searchPrices({ q, registrarId, page }),
    getRegistrarOptions(),
  ])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const buildHref = (p: number) => {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (registrarId) params.set("registrar", String(registrarId))
    params.set("page", String(p))
    return `/admin/prices?${params.toString()}`
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="价格数据"
        description="搜索、浏览各后缀在各注册商的价格，可手动纠正异常价（旧值自动存入历史）。"
      />

      {/* 过滤器（服务端 GET 表单，无需 JS） */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <label htmlFor="q" className="text-xs font-medium text-muted-foreground">
            搜索后缀
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="q" name="q" defaultValue={q} placeholder="如 com、ai、io" className="pl-9" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="registrar" className="text-xs font-medium text-muted-foreground">
            注册商
          </label>
          <select
            id="registrar"
            name="registrar"
            defaultValue={registrarId ? String(registrarId) : ""}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="">全部注册商</option>
            {registrarOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit">筛选</Button>
        {q || registrarId ? (
          <Button type="button" variant="ghost" render={<Link href="/admin/prices">重置</Link>} />
        ) : null}
      </form>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          共 <span className="font-mono font-medium text-foreground">{total}</span> 条记录
        </span>
        <span>
          第 {page} / {totalPages} 页
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Search} title="未找到价格记录" hint="尝试调整搜索关键词或注册商筛选。" />
      ) : (
        <PriceTable rows={rows as PriceRow[]} />
      )}

      {/* 分页 */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          {page <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              上一页
            </Button>
          ) : (
            <Button variant="outline" size="sm" render={<Link href={buildHref(page - 1)} />}>
              上一页
            </Button>
          )}
          <span className="px-2 text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          {page >= totalPages ? (
            <Button variant="outline" size="sm" disabled>
              下一页
            </Button>
          ) : (
            <Button variant="outline" size="sm" render={<Link href={buildHref(page + 1)} />}>
              下一页
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}
