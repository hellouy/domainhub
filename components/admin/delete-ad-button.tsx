"use client"

import { useTransition } from "react"
import { deleteAd } from "@/app/actions/admin"
import { Trash2 } from "lucide-react"

export function DeleteAdButton({ id }: { id: number }) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm(`确认删除广告 #${id}？此操作不可撤销。`)) {
          startTransition(() => deleteAd(id))
        }
      }}
      className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
    >
      <Trash2 className="size-3.5" aria-hidden />
      删除
    </button>
  )
}
