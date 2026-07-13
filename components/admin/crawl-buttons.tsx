"use client"

import { useState, useTransition } from "react"
import { triggerCrawl, triggerCrawlAll } from "@/app/actions/admin"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export function CrawlAllButton() {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  return (
    <div className="flex items-center gap-3">
      {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const results = await triggerCrawlAll()
            const ok = results.filter((r) => r.ok).length
            setMessage(`完成：${ok}/${results.length} 个注册商采集成功`)
            router.refresh()
          })
        }
      >
        {pending ? "采集中…" : "全量采集"}
      </Button>
    </div>
  )
}

export function CrawlOneButton({ registrarId }: { registrarId: number }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await triggerCrawl(registrarId)
          router.refresh()
        })
      }
    >
      {pending ? "采集中…" : "采集"}
    </Button>
  )
}
