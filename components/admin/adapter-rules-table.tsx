"use client"

import { useState, useTransition } from "react"
import { CheckCircle2, Ban, Play, Pause, Loader2, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/admin/ui"
import { activateRule, rejectRule, setRegistrarActive } from "@/app/actions/discovery"
import { FileCode2 } from "lucide-react"

interface Rule {
  id: number
  registrarId: number
  slug: string
  registrarName: string
  isActive: boolean
  config: Record<string, unknown>
  status: string
  modelUsed: string
  verification: Record<string, unknown> | null
  trigger: string
  createdAt: string
}

const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: "生效中", cls: "border-primary/40 text-primary" },
  candidate: { label: "候选", cls: "border-border text-foreground" },
  rejected: { label: "已拒绝", cls: "border-destructive/40 text-destructive" },
  superseded: { label: "已替换", cls: "border-border text-muted-foreground" },
}

export function AdapterRulesTable({ rules }: { rules: Rule[] }) {
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const withBusy = (id: number, fn: () => Promise<{ message: string }>) => {
    setBusyId(id)
    startTransition(async () => {
      try {
        const r = await fn()
        setMsg(r.message)
        window.setTimeout(() => setMsg(null), 5000)
      } finally {
        setBusyId(null)
      }
    })
  }

  if (rules.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={FileCode2}
            title="暂无规则"
            hint="在「注册商发现」中提升候选后生成规则，或对已有注册商触发 AI 修复。"
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {msg ? (
        <div className="rounded-md border border-border bg-accent px-4 py-2 text-sm text-accent-foreground" role="status">
          {msg}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">规则列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col divide-y divide-border">
            {rules.map((r) => {
              const st = STATUS[r.status] ?? { label: r.status, cls: "border-border text-foreground" }
              const cfg = r.config as {
                urls?: string[]
                columnOrder?: string[]
                numberFormat?: string
                currency?: string
                confidence?: number
              }
              const ver = r.verification as { parsedCount?: number; passed?: boolean } | null
              const isBusy = busyId === r.id && pending
              const isOpen = expanded === r.id
              return (
                <div key={r.id} className="py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : r.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      aria-expanded={isOpen}
                    >
                      {isOpen ? (
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      ) : (
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium text-foreground">{r.registrarName}</span>
                          <span className="font-mono text-xs text-muted-foreground">{r.slug}</span>
                          <Badge variant="outline" className={st.cls}>
                            {st.label}
                          </Badge>
                          {r.isActive ? (
                            <Badge variant="outline" className="border-primary/40 text-primary">
                              采集已启用
                            </Badge>
                          ) : (
                            <Badge variant="secondary">未启用采集</Badge>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span>模型 {r.modelUsed}</span>
                          <span>货币 {cfg.currency ?? "—"}</span>
                          <span>列序 {cfg.columnOrder?.join("/") ?? "—"}</span>
                          {ver?.parsedCount != null ? <span>验证解析 {ver.parsedCount} 个 TLD</span> : null}
                        </div>
                      </div>
                    </button>

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {r.status !== "active" ? (
                        <Button size="sm" disabled={pending} onClick={() => withBusy(r.id, () => activateRule(r.id))}>
                          {isBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
                          激活
                        </Button>
                      ) : null}
                      {r.status === "active" ? (
                        r.isActive ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => withBusy(r.id, () => setRegistrarActive(r.registrarId, false))}
                          >
                            <Pause className="size-4" aria-hidden />
                            停用采集
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled={pending}
                            onClick={() => withBusy(r.id, () => setRegistrarActive(r.registrarId, true))}
                          >
                            <Play className="size-4" aria-hidden />
                            启用采集
                          </Button>
                        )
                      ) : null}
                      {r.status !== "rejected" ? (
                        <Button size="sm" variant="outline" disabled={pending} onClick={() => withBusy(r.id, () => rejectRule(r.id))}>
                          <Ban className="size-4" aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {isOpen ? (
                    <div className="mt-3 rounded-md border border-border bg-muted/40 p-3">
                      <div className="mb-2 text-xs font-medium text-muted-foreground">规则配置</div>
                      <div className="flex flex-col gap-1 text-xs">
                        <div>
                          <span className="text-muted-foreground">URLs：</span>
                          {cfg.urls?.length ? (
                            <ul className="ml-4 list-disc">
                              {cfg.urls.map((u) => (
                                <li key={u} className="break-all font-mono">
                                  {u}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            "—"
                          )}
                        </div>
                        <div>
                          <span className="text-muted-foreground">数字格式：</span>
                          <span className="font-mono">{cfg.numberFormat ?? "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">列语义顺序：</span>
                          <span className="font-mono">{cfg.columnOrder?.join(" → ") ?? "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">触发来源：</span>
                          <span className="font-mono">{r.trigger}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">创建时间：</span>
                          <span className="font-mono">{new Date(r.createdAt).toLocaleString("zh-CN")}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
