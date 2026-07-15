"use client"

import { useState, useTransition } from "react"
import { Search, CheckCircle2, XCircle, Loader2, Database, Code2, Globe } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { probeRegistrarUrl } from "@/app/actions/admin"

interface ProbeSample {
  tld: string
  registerPrice?: number | null
  renewPrice?: number | null
  transferPrice?: number | null
}
interface ProbeResult {
  ok: boolean
  strategy: string
  count: number
  currency: string
  samples: ProbeSample[]
  capturedEndpoints?: string[]
  message: string
  error?: string
}

/** 策略标签的中文说明与图标 */
const STRATEGY_META: Record<string, { label: string; icon: typeof Database; desc: string }> = {
  "static-json": { label: "静态内嵌 JSON", icon: Code2, desc: "从页面内嵌 JSON(如 __NEXT_DATA__)直接读取" },
  "static-html": { label: "静态 HTML 表格", icon: Globe, desc: "从静态 HTML 结构解析" },
  "rendered-xhr": { label: "渲染 + XHR 数据源", icon: Database, desc: "无头浏览器渲染并捕获 XHR/API 真实数据源" },
  "rendered-html": { label: "渲染后 HTML", icon: Globe, desc: "无头浏览器渲染后从 DOM 解析" },
  none: { label: "未发现", icon: XCircle, desc: "所有策略均未发现价格" },
}

export function UrlProbe() {
  const [url, setUrl] = useState("")
  const [result, setResult] = useState<ProbeResult | null>(null)
  const [pending, startTransition] = useTransition()

  function handleProbe() {
    if (!url.trim()) return
    setResult(null)
    startTransition(async () => {
      try {
        const r = (await probeRegistrarUrl(url.trim())) as ProbeResult
        setResult(r)
      } catch (e) {
        setResult({
          ok: false, strategy: "none", count: 0, currency: "UNKNOWN", samples: [],
          message: "探测失败", error: e instanceof Error ? e.message : String(e),
        })
      }
    })
  }

  const meta = result ? (STRATEGY_META[result.strategy] ?? STRATEGY_META.none) : null
  const StrategyIcon = meta?.icon ?? Search

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Search className="size-4 text-primary" />
            {"自动探测价格页"}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground text-pretty">
            {"输入注册商的价格/价目表页面网址，系统会自动依次尝试内嵌 JSON、静态表格、无头渲染 + XHR 数据源，返回可抓取性预览（不写入数据库）。"}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="url"
            inputMode="url"
            placeholder="https://example.com/domain-pricing"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) handleProbe()
            }}
            disabled={pending}
            className="font-mono text-sm"
          />
          <Button onClick={handleProbe} disabled={pending || !url.trim()} className="shrink-0">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            {pending ? "探测中…" : "开始探测"}
          </Button>
        </div>

        {pending ? (
          <p className="text-xs text-muted-foreground">
            {"正在尝试多种策略，渲染动态页面可能需要 10–30 秒，请稍候…"}
          </p>
        ) : null}

        {result ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex flex-wrap items-center gap-2">
              {result.ok ? (
                <CheckCircle2 className="size-5 text-primary" />
              ) : (
                <XCircle className="size-5 text-destructive" />
              )}
              <span className="text-sm font-medium text-foreground">{result.message}</span>
            </div>

            {result.ok ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <StrategyIcon className="size-3" />
                  {meta?.label}
                </Badge>
                <Badge variant="outline">{`${result.count} 个后缀`}</Badge>
                <Badge variant="outline">{`货币 ${result.currency}`}</Badge>
              </div>
            ) : null}

            {meta && result.ok ? <p className="text-xs text-muted-foreground">{meta.desc}</p> : null}

            {result.capturedEndpoints && result.capturedEndpoints.length > 0 ? (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-foreground">{"捕获到的数据源端点："}</p>
                <ul className="flex flex-col gap-0.5">
                  {result.capturedEndpoints.map((ep) => (
                    <li key={ep} className="truncate font-mono text-[11px] text-muted-foreground">
                      {ep}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.samples.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="py-1 pr-4 font-medium">{"后缀"}</th>
                      <th className="py-1 pr-4 font-medium">{"注册"}</th>
                      <th className="py-1 pr-4 font-medium">{"续费"}</th>
                      <th className="py-1 font-medium">{"转入"}</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {result.samples.map((s, i) => (
                      <tr key={`${s.tld}-${i}`} className="border-t border-border/50">
                        <td className="py-1 pr-4 text-foreground">{s.tld}</td>
                        <td className="py-1 pr-4 text-muted-foreground">{s.registerPrice ?? "—"}</td>
                        <td className="py-1 pr-4 text-muted-foreground">{s.renewPrice ?? "—"}</td>
                        <td className="py-1 text-muted-foreground">{s.transferPrice ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.count > result.samples.length ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {`仅显示前 ${result.samples.length} 条，共发现 ${result.count} 条。`}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
