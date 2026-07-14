"use client"

import { useState, useTransition } from "react"
import { RefreshCw } from "lucide-react"
import { triggerReplicationAction } from "@/app/actions/replication"
import { Button } from "@/components/ui/button"

export function ReplicationSyncButton() {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  function handleClick() {
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await triggerReplicationAction()
        if (result.ok) {
          const total = Object.values(result.tables).reduce((a: number, b: number) => a + b, 0)
          setMessage({ ok: true, text: `同步完成，共 ${total.toLocaleString()} 行，用时 ${result.durationMs}ms` })
        } else {
          setMessage({ ok: false, text: result.error ?? "同步失败" })
        }
      } catch (err) {
        setMessage({ ok: false, text: err instanceof Error ? err.message : "同步失败" })
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleClick} disabled={isPending} size="sm">
        <RefreshCw className={isPending ? "size-4 animate-spin" : "size-4"} aria-hidden />
        {isPending ? "同步中…" : "立即同步到备库"}
      </Button>
      {message ? (
        <p className={message.ok ? "text-xs text-primary" : "text-xs text-destructive"}>{message.text}</p>
      ) : null}
    </div>
  )
}
