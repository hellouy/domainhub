"use client"

import { useState, useTransition } from "react"
import { Search, Radar, Compass, ExternalLink, Check, X, Trash2, Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/admin/ui"
import { normalizeUrl } from "@/lib/utils"
import {
  runDiscovery,
  runDiscoveryBatch,
  scanCandidate,
  approveCandidate,
  rejectCandidate,
  deleteCandidate,
  generateRule,
} from "@/app/actions/discovery"

interface Candidate {
  id: number
  name: string
  website: string
  pricePage: string | null
  source: string
  confidence: number
  status: string
  evidence: Record<string, unknown> | null
  promotedSlug: string | null
  createdAt: string
}

const STATUS_LABEL: Record<string, string> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已拒绝",
  promoted: "已提升",
}

function confidenceTone(c: number): "positive" | "warning" | "danger" {
  if (c >= 55) return "positive"
  if (c >= 25) return "warning"
  return "danger"
}

export function DiscoveryPanel({ candidates }: { candidates: Candidate[] }) {
  const [singleUrl, setSingleUrl] = useState("")
  const [batchText, setBatchText] = useState("")
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<number | null>(null)

  const notify = (m: string) => {
    setMsg(m)
    window.clearTimeout((notify as unknown as { _t?: number })._t)
    ;(notify as unknown as { _t?: number })._t = window.setTimeout(() => setMsg(null), 6000)
  }

  const onSingle = () => {
    if (!singleUrl.trim()) return
    startTransition(async () => {
      const r = await runDiscovery(singleUrl)
      notify(r.message)
      if (r.ok) setSingleUrl("")
    })
  }

  const onBatch = () => {
    if (!batchText.trim()) return
    startTransition(async () => {
      const r = await runDiscoveryBatch(batchText)
      notify(r.message)
      if (r.ok) setBatchText("")
    })
  }

  const withBusy = (id: number, fn: () => Promise<{ message: string }>) => {
    setBusyId(id)
    startTransition(async () => {
      try {
        const r = await fn()
        notify(r.message)
      } finally {
        setBusyId(null)
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 输入区 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">发现单个注册商</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input
                value={singleUrl}
                onChange={(e) => setSingleUrl(e.target.value)}
                placeholder="如 porkbun.com 或 https://www.example.com/pricing"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) onSingle()
                }}
              />
              <Button onClick={onSingle} disabled={pending || !singleUrl.trim()}>
                <Search className="size-4" aria-hidden />
                发现
              </Button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              自动探测 /pricing、/domains、/tlds 等路径，用 TLD+价格表格行数评估信心分。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">批量发现（每行一个 URL，最多 30 个）</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <textarea
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              rows={3}
              placeholder={"namecheap.com\ngodaddy.com\ndynadot.com"}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button onClick={onBatch} disabled={pending || !batchText.trim()} className="self-start">
              <Radar className="size-4" aria-hidden />
              批量发现
            </Button>
          </CardContent>
        </Card>
      </div>

      {msg ? (
        <div className="rounded-md border border-border bg-accent px-4 py-2 text-sm text-accent-foreground" role="status">
          {pending ? <Loader2 className="mr-2 inline size-4 animate-spin" aria-hidden /> : null}
          {msg}
        </div>
      ) : null}

      {/* 候选列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">候选池</CardTitle>
        </CardHeader>
        <CardContent>
          {candidates.length === 0 ? (
            <EmptyState icon={Compass} title="暂无候选" hint="在上方输入 URL 开始发现注册商。" />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {candidates.map((c) => {
                const href = normalizeUrl(c.pricePage, c.website)
                const scan = (c.evidence?.scan as { suggestedStrategy?: string | null } | undefined) ?? undefined
                const isBusy = busyId === c.id && pending
                return (
                  <div key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium text-foreground">{c.name}</span>
                        <Badge
                          variant="outline"
                          className={
                            confidenceTone(c.confidence) === "positive"
                              ? "border-primary/40 text-primary"
                              : confidenceTone(c.confidence) === "warning"
                                ? "border-border text-foreground"
                                : "border-destructive/40 text-destructive"
                          }
                        >
                          信心 {c.confidence}
                        </Badge>
                        <Badge variant="secondary">{STATUS_LABEL[c.status] ?? c.status}</Badge>
                        {scan?.suggestedStrategy ? (
                          <Badge variant="outline" className="font-mono text-xs">
                            {scan.suggestedStrategy}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 truncate hover:text-foreground hover:underline"
                          >
                            <ExternalLink className="size-3 shrink-0" aria-hidden />
                            <span className="truncate">{c.pricePage ?? c.website}</span>
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 truncate">
                            <ExternalLink className="size-3 shrink-0 opacity-50" aria-hidden />
                            <span className="truncate">{c.website}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => withBusy(c.id, () => scanCandidate(c.id))}
                      >
                        {isBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Radar className="size-4" aria-hidden />}
                        扫描
                      </Button>
                      {c.status !== "promoted" ? (
                        <Button
                          size="sm"
                          disabled={pending}
                          onClick={() => withBusy(c.id, () => approveCandidate(c.id))}
                        >
                          <Check className="size-4" aria-hidden />
                          通过
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending || !c.promotedSlug}
                          onClick={() =>
                            withBusy(c.id, () =>
                              c.promotedSlug
                                ? generateRule(c.promotedSlug)
                                : Promise.resolve({ message: "未找到对应注册商 slug" }),
                            )
                          }
                        >
                          <Sparkles className="size-4" aria-hidden />
                          生成规则
                        </Button>
                      )}
                      {c.status !== "rejected" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => withBusy(c.id, () => rejectCandidate(c.id))}
                        >
                          <X className="size-4" aria-hidden />
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => withBusy(c.id, () => deleteCandidate(c.id))}
                        aria-label="删除候选"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
