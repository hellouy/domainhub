import Link from "next/link"
import { Search, Globe } from "lucide-react"
import { searchTlds, getTldCounts } from "@/lib/db/admin-queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader, EmptyState } from "@/components/admin/ui"
import { TldTable, type TldRow } from "@/components/admin/tld-table"
import { cn } from "@/lib/utils"

type Filter = "all" | "popular" | "valid" | "invalid"

export default async function AdminTldsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>
}) {
  const sp = await searchParams
  const q = sp.q?.trim() ?? ""
  const filter = (["all", "popular", "valid", "invalid"].includes(sp.filter ?? "")
    ? sp.filter
    : "all") as Filter
  const page = sp.page ? Math.max(1, Number(sp.page)) : 1

  const [{ rows, total, pageSize }, counts] = await Promise.all([
    searchTlds({ q, filter, page }),
    getTldCounts(),
  ])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "全部", count: counts.all },
    { key: "popular", label: "热门", count: counts.popular },
    { key: "valid", label: "有效", count: counts.valid },
    { key: "invalid", label: "无效", count: counts.invalid },
  ]

  const buildHref = (opts: { filter?: Filter; page?: number }) => {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    params.set("filter", opts.filter ?? filter)
    params.set("page", String(opts.page ?? 1))
    return `/admin/tlds?${params.toString()}`
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="后缀管理"
        description="管理收录的顶级域名后缀：标记热门、编辑介绍与热度分、控制是否在前台展示。"
      />

      {/* 过滤标签 */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={buildHref({ filter: t.key, page: 1 })}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              filter === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              {t.count}
            </span>
          </Link>
        ))}
      </div>

      {/* 搜索 */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="filter" value={filter} />
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <label htmlFor="q" className="text-xs font-medium text-muted-foreground">
            搜索后缀
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="q" name="q" defaultValue={q} placeholder="如 com、ai、io" className="pl-9" />
          </div>
        </div>
        <Button type="submit">筛选</Button>
        {q ? <Button type="button" variant="ghost" render={<Link href={buildHref({ page: 1 })} />}>重置</Button> : null}
      </form>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          共 <span className="font-mono font-medium text-foreground">{total}</span> 个后缀
        </span>
        <span>
          第 {page} / {totalPages} 页
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Globe} title="未找到后缀" hint="尝试调整搜索或切换过滤标签。" />
      ) : (
        <TldTable rows={rows as TldRow[]} />
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          {page <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              上一页
            </Button>
          ) : (
            <Button variant="outline" size="sm" render={<Link href={buildHref({ page: page - 1 })} />}>
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
            <Button variant="outline" size="sm" render={<Link href={buildHref({ page: page + 1 })} />}>
              下一页
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}
