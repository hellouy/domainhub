"use client"

import { useTransition } from "react"
import { toggleAdActive } from "@/app/actions/admin"

export function AdToggle({ id, isActive }: { id: number; isActive: boolean }) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => toggleAdActive(id, !isActive))}
      className={
        isActive
          ? "inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 hover:bg-green-500/20"
          : "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted/80"
      }
    >
      {isActive ? "启用" : "停用"}
    </button>
  )
}
