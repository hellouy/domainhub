"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Radar, Sparkles, PlayCircle, Save } from "lucide-react"
import { saveCrawlUrls, scanUrl, repairRegistrar, testCrawlRegistrar } from "@/app/actions/crawl-admin"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type Tone = "ok" | "fail" | "info"

type StepResult = { tone: Tone; text: string } | null

type ScanSignal = { strategy: string; detected: boolean; strength: number; detail: string }

const strategyLabel: Record<string, string> = {
  api: "官方 API",
  xhr: "XHR 接口",
  graphql: "GraphQL",
  "embedded-json": "内嵌 JSON",
  html: "HTML 表格",
  playwright: "浏览器渲染",
}

function ResultLine({ result }: { result: StepResult }) {
  if (!result) return null
  return (
    <p
      className={cn(
        "text-xs leading-relaxed",
        result.tone === "ok" && "text-primary",
        result.tone === "fail" && "text-destructive",
        result.tone === "info" && "text-muted-foreground",
      )}
    >
      {result.text}
    </p>
  )
}

export function RegistrarOnboardDialog({
  registrarId,
  name,
  website,
  initialUrls,
  hasActiveRule,
}: {
  registrarId: number
  name: string
  website: string
  initialUrls: string[]
  hasActiveRule: boolean
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const [urlsText, setUrlsText] = useState((initialUrls.length ? initialUrls : [website]).join("\n"))
  const [saveMsg, setSaveMsg] = useState<StepResult>(null)
  const [scan, setScan] = useState<{ suggested?: string; signals: ScanSignal[]; msg: StepResult } | null>(null)
  const [repair, setRepair] = useState<StepResult>(null)
  const [crawl, setCrawl] = useState<StepResult>(null)

  const [saving, saveT] = useTransition()
  const [scanning, scanT] = useTransition()
  const [repairing, repairT] = useTransition()
  const [crawling, crawlT] = useTransition()

  const firstUrl = urlsText.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)[0] ?? ""

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            采集接入
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>采集接入 · {name}</DialogTitle>
          <DialogDescription>
            配置价格页地址,扫描可用策略,让 AI 自动识别页面结构生成解析规则,再试采集验证。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {/* 采集地址 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={`urls-${registrarId}`}>采集地址(价格页 URL，每行一个)</Label>
              {hasActiveRule ? (
                <Badge>已有生效规则</Badge>
              ) : (
                <Badge variant="secondary">尚无规则</Badge>
              )}
            </div>
            <textarea
              id={`urls-${registrarId}`}
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
              rows={3}
              spellCheck={false}
              placeholder="https://example.com/pricing"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() =>
                  saveT(async () => {
                    const r = await saveCrawlUrls(registrarId, urlsText)
                    setSaveMsg({ tone: r.ok ? "ok" : "fail", text: r.message })
                    router.refresh()
                  })
                }
              >
                <Save className="size-4" />
                {saving ? "保存中…" : "保存地址"}
              </Button>
              <ResultLine result={saveMsg} />
            </div>
          </div>

          {/* 三个操作 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Button
              variant="secondary"
              disabled={scanning || !firstUrl}
              onClick={() =>
                scanT(async () => {
                  setScan(null)
                  const r = await scanUrl(firstUrl)
                  if (!("signals" in r) || !r.signals) {
                    setScan({ signals: [], msg: { tone: "fail", text: r.message } })
                    return
                  }
                  setScan({
                    suggested: r.suggestedStrategy ?? undefined,
                    signals: r.signals as ScanSignal[],
                    msg: { tone: r.ok ? "ok" : "info", text: r.message },
                  })
                })
              }
            >
              <Radar className="size-4" />
              {scanning ? "扫描中…" : "扫描策略"}
            </Button>
            <Button
              disabled={repairing}
              onClick={() =>
                repairT(async () => {
                  setRepair({ tone: "info", text: "AI 正在分析页面结构并生成规则…" })
                  const r = await repairRegistrar(registrarId)
                  setRepair({
                    tone: r.ok ? "ok" : "fail",
                    text: `${r.message}${r.modelUsed ? `（模型 ${r.modelUsed}）` : ""}`,
                  })
                  router.refresh()
                })
              }
            >
              <Sparkles className="size-4" />
              {repairing ? "AI 分析中…" : "AI 生成规则"}
            </Button>
            <Button
              variant="outline"
              disabled={crawling}
              onClick={() =>
                crawlT(async () => {
                  setCrawl({ tone: "info", text: "正在试采集…" })
                  const r = await testCrawlRegistrar(registrarId)
                  setCrawl({
                    tone: r.ok ? "ok" : "fail",
                    text: r.ok
                      ? `采集成功：共 ${r.totalTlds} 个后缀，更新 ${r.updated} 条（任务 #${r.jobId}）`
                      : `采集失败：${r.error ?? r.message}`,
                  })
                  router.refresh()
                })
              }
            >
              <PlayCircle className="size-4" />
              {crawling ? "采集中…" : "试采集"}
            </Button>
          </div>

          {/* 结果诊断区 */}
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4">
            {/* 扫描结果 */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">扫描诊断</p>
              {scan ? (
                <div className="flex flex-col gap-2">
                  <ResultLine result={scan.msg} />
                  {scan.suggested ? (
                    <p className="text-xs text-foreground">
                      建议策略：
                      <Badge className="ml-1">{strategyLabel[scan.suggested] ?? scan.suggested}</Badge>
                    </p>
                  ) : null}
                  {scan.signals.length ? (
                    <ul className="flex flex-col gap-1">
                      {scan.signals.map((s) => (
                        <li key={s.strategy} className="flex items-center gap-2 text-xs">
                          <span className={cn("size-2 rounded-full", s.detected ? "bg-primary" : "bg-border")} />
                          <span className="w-20 text-foreground">{strategyLabel[s.strategy] ?? s.strategy}</span>
                          <span className="font-mono text-muted-foreground">强度 {s.strength}</span>
                          <span className="truncate text-muted-foreground">{s.detail}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">点击「扫描策略」检测该地址支持哪种采集方式。</p>
              )}
            </div>

            <div className="h-px bg-border" />

            {/* AI 生成结果 */}
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AI 规则生成</p>
              {repair ? (
                <ResultLine result={repair} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  AI 抓取页面 → 识别列结构与数字格式 → 生成规则并确定性验证，通过即激活。
                </p>
              )}
            </div>

            <div className="h-px bg-border" />

            {/* 试采集结果 */}
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">试采集</p>
              {crawl ? (
                <ResultLine result={crawl} />
              ) : (
                <p className="text-xs text-muted-foreground">用当前生效规则立即采集一次，验证是否成功入库。</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
