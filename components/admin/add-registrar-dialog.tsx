"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { createRegistrar } from "@/app/actions/crawl-admin"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function AddRegistrarDialog() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const [state, formAction, pending] = useActionState(createRegistrar, null)

  useEffect(() => {
    if (state?.ok) {
      setOpen(false)
      router.refresh()
    }
  }, [state, router])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" />
            添加注册商
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加注册商</DialogTitle>
          <DialogDescription>
            手动录入注册商与价格页地址。创建后默认未启用，可在「采集接入」中让 AI 生成规则并试采集。
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-name">名称</Label>
            <Input id="add-name" name="name" placeholder="如 Porkbun" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-website">官网地址</Label>
            <Input id="add-website" name="website" type="url" placeholder="https://porkbun.com" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-desc">简介（可选）</Label>
            <Input id="add-desc" name="description" placeholder="一句话简介" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-urls">采集地址（价格页 URL，每行一个，可选）</Label>
            <textarea
              id="add-urls"
              name="crawlUrls"
              rows={3}
              spellCheck={false}
              placeholder="https://porkbun.com/products/domains"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {state?.message ? (
            <p className={cn("text-sm", state.ok ? "text-primary" : "text-destructive")}>{state.message}</p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "创建中…" : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
