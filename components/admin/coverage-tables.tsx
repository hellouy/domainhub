"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

/**
 * 覆盖率中心的两张可筛选/排序表：注册商覆盖率、后缀覆盖率。
 * 数据由服务端一次性传入，筛选与排序在客户端完成。
 */

interface RegistrarRow {
  id: number
  slug: string
  name: string
  isActive: boolean
  sourceType: string | null
  priceCount: number
  coveragePct: number
  missingRegister: number
  missingRenew: number
  missingTransfer: number
  lastCrawlAt: string | null
  lastCrawlStatus: string | null
  healthScore: number
}

interface TldRow {
  tld: string
  type: string
  registrarCount: number
  coveragePct: number
  minRegister: string | null
  maxRegister: string | null
}

type RegistrarSort = "coverage" | "health" | "prices" | "name"
type TldSort = "coverage" | "tld" | "minPrice"

const SOURCE_LABEL: Record<string, string> = {
  api: "API",
  json: "JSON",
  html: "HTML",
  playwright: "Playwright",
  seed: "种子",
}

function healthColor(score: number) {
  if (score >= 80) return "text-primary"
  if (score >= 50) return "text-foreground"
  return "text-destructive"
}

function formatTime(iso: string | null) {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso))
}

export function CoverageTables({
  perRegistrar,
  perTld,
  totalTlds,
}: {
  perRegistrar: RegistrarRow[]
  perTld: TldRow[]
  totalTlds: number
}) {
  // —— 注册商表状态 ——
  const [registrarFilter, setRegistrarFilter] = useState("")
  const [registrarSort, setRegistrarSort] = useState<RegistrarSort>("health")
  // —— 后缀表状态 ——
  const [tldFilter, setTldFilter] = useState("")
  const [tldSort, setTldSort] = useState<TldSort>("coverage")
  const [tldLimit, setTldLimit] = useState(30)

  const registrarRows = useMemo(() => {
    const keyword = registrarFilter.trim().toLowerCase()
    const filtered = perRegistrar.filter(
      (r) => !keyword || r.name.toLowerCase().includes(keyword) || r.slug.includes(keyword),
    )
    const sorters: Record<RegistrarSort, (a: RegistrarRow, b: RegistrarRow) => number> = {
      coverage: (a, b) => b.coveragePct - a.coveragePct,
      health: (a, b) => b.healthScore - a.healthScore,
      prices: (a, b) => b.priceCount - a.priceCount,
      name: (a, b) => a.name.localeCompare(b.name),
    }
    return [...filtered].sort(sorters[registrarSort])
  }, [perRegistrar, registrarFilter, registrarSort])

  const tldRows = useMemo(() => {
    const keyword = tldFilter.trim().toLowerCase().replace(/^\./, "")
    const filtered = perTld.filter((t) => !keyword || t.tld.includes(keyword))
    const sorters: Record<TldSort, (a: TldRow, b: TldRow) => number> = {
      coverage: (a, b) => b.coveragePct - a.coveragePct || a.tld.localeCompare(b.tld),
      tld: (a, b) => a.tld.localeCompare(b.tld),
      minPrice: (a, b) => Number(a.minRegister ?? Infinity) - Number(b.minRegister ?? Infinity),
    }
    return [...filtered].sort(sorters[tldSort])
  }, [perTld, tldFilter, tldSort])

  const registrarSortOptions: { key: RegistrarSort; label: string }[] = [
    { key: "health", label: "健康分" },
    { key: "coverage", label: "覆盖率" },
    { key: "prices", label: "价格数" },
    { key: "name", label: "名称" },
  ]
  const tldSortOptions: { key: TldSort; label: string }[] = [
    { key: "coverage", label: "覆盖率" },
    { key: "tld", label: "后缀" },
    { key: "minPrice", label: "最低价" },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* —— 注册商覆盖率 —— */}
      <Card>
        <CardHeader className="flex flex-col gap-3">
          <CardTitle className="text-base">注册商覆盖率（{registrarRows.length}）</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={registrarFilter}
              onChange={(e) => setRegistrarFilter(e.target.value)}
              placeholder="筛选注册商…"
              className="h-8 w-48"
              aria-label="筛选注册商"
            />
            <div className="flex items-center gap-1" role="group" aria-label="注册商排序">
              {registrarSortOptions.map((opt) => (
                <Button
                  key={opt.key}
                  size="sm"
                  variant={registrarSort === opt.key ? "default" : "outline"}
                  onClick={() => setRegistrarSort(opt.key)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {registrarRows.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">{r.name}</span>
                {r.sourceType && (
                  <Badge variant={r.sourceType === "seed" ? "outline" : "secondary"}>
                    {SOURCE_LABEL[r.sourceType] ?? r.sourceType}
                  </Badge>
                )}
                {!r.isActive && <Badge variant="outline">已停用</Badge>}
                <span className={`ml-auto font-mono text-sm font-semibold ${healthColor(r.healthScore)}`}>
                  {r.healthScore} 分
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  覆盖率 <span className="font-mono text-foreground">{r.coveragePct}%</span>（{r.priceCount}/
                  {totalTlds}）
                </span>
                <span>
                  缺失：注册 <span className="font-mono">{r.missingRegister}</span> / 续费{" "}
                  <span className="font-mono">{r.missingRenew}</span> / 转入{" "}
                  <span className="font-mono">{r.missingTransfer}</span>
                </span>
                <span>最近采集：{formatTime(r.lastCrawlAt)}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-primary" style={{ width: `${r.coveragePct}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* —— 后缀覆盖率 —— */}
      <Card>
        <CardHeader className="flex flex-col gap-3">
          <CardTitle className="text-base">后缀覆盖率（{tldRows.length}）</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={tldFilter}
              onChange={(e) => setTldFilter(e.target.value)}
              placeholder="筛选后缀…"
              className="h-8 w-48"
              aria-label="筛选后缀"
            />
            <div className="flex items-center gap-1" role="group" aria-label="后缀排序">
              {tldSortOptions.map((opt) => (
                <Button
                  key={opt.key}
                  size="sm"
                  variant={tldSort === opt.key ? "default" : "outline"}
                  onClick={() => setTldSort(opt.key)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-normal">后缀</th>
                  <th className="py-2 pr-4 font-normal">类型</th>
                  <th className="py-2 pr-4 font-normal">注册商数</th>
                  <th className="py-2 pr-4 font-normal">覆盖率</th>
                  <th className="py-2 pr-4 font-normal">最低注册价</th>
                  <th className="py-2 font-normal">最高注册价</th>
                </tr>
              </thead>
              <tbody>
                {tldRows.slice(0, tldLimit).map((t) => (
                  <tr key={t.tld} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-foreground">.{t.tld}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{t.type}</td>
                    <td className="py-2 pr-4 font-mono">{t.registrarCount}</td>
                    <td className="py-2 pr-4 font-mono">{t.coveragePct}%</td>
                    <td className="py-2 pr-4 font-mono">{t.minRegister ?? "—"}</td>
                    <td className="py-2 font-mono">{t.maxRegister ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tldRows.length > tldLimit && (
            <div className="mt-3 flex justify-center">
              <Button variant="outline" size="sm" onClick={() => setTldLimit((n) => n + 50)}>
                加载更多（剩余 {tldRows.length - tldLimit}）
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
