"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Star } from "lucide-react"
import { toggleTldPopular, toggleTldValid, updateTld } from "@/app/actions/tlds"
import { Badge } from "@/components/ui/badge"
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
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { tldTypeLabel } from "@/lib/format"

export type TldRow = {
  id: number
  tld: string
  type: string
  description: string
  isPopular: boolean
  isValid: boolean
  popularity: number
  priceCount: number
}

function PopularToggle({ row }: { row: TldRow }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`${row.tld} 热门标记`}
      aria-pressed={row.isPopular}
      onClick={() =>
        startTransition(async () => {
          await toggleTldPopular(row.id, !row.isPopular)
          router.refresh()
        })
      }
      className="inline-flex items-center justify-center rounded p-1 hover:bg-accent disabled:opacity-50"
    >
      <Star
        className={row.isPopular ? "size-4 fill-primary text-primary" : "size-4 text-muted-foreground"}
      />
    </button>
  )
}

function ValidSwitch({ row }: { row: TldRow }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  return (
    <Switch
      checked={row.isValid}
      disabled={pending}
      aria-label={`${row.tld} 有效状态`}
      onCheckedChange={(checked) =>
        startTransition(async () => {
          await toggleTldValid(row.id, checked)
          router.refresh()
        })
      }
    />
  )
}

function EditTldDialog({ row }: { row: TldRow }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" aria-label={`编辑 ${row.tld}`}>
            <Pencil className="size-3.5" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑后缀 · {row.tld}</DialogTitle>
          <DialogDescription>调整类型、介绍文案与热度分（热度分越高在前台越靠前）。</DialogDescription>
        </DialogHeader>
        <form
          action={(formData) =>
            startTransition(async () => {
              await updateTld(row.id, formData)
              setOpen(false)
              router.refresh()
            })
          }
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`type-${row.id}`}>类型</Label>
              <select
                id={`type-${row.id}`}
                name="type"
                defaultValue={row.type}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="gTLD">通用顶级域名 gTLD</option>
                <option value="ccTLD">国家域名 ccTLD</option>
                <option value="newG">新顶级域名 newG</option>
                <option value="sld">二级域名 sld</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`pop-${row.id}`}>热度分</Label>
              <Input
                id={`pop-${row.id}`}
                name="popularity"
                type="number"
                min="0"
                step="1"
                defaultValue={row.popularity}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`desc-${row.id}`}>介绍文案</Label>
            <Input id={`desc-${row.id}`} name="description" defaultValue={row.description} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TldTable({ rows }: { rows: TldRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-center">热门</TableHead>
            <TableHead>后缀</TableHead>
            <TableHead>类型</TableHead>
            <TableHead className="text-right">热度分</TableHead>
            <TableHead className="text-right">价格数</TableHead>
            <TableHead className="text-center">有效</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-center">
                <PopularToggle row={r} />
              </TableCell>
              <TableCell className="font-mono font-medium text-foreground">{r.tld}</TableCell>
              <TableCell>
                <Badge variant="secondary">{tldTypeLabel(r.type)}</Badge>
              </TableCell>
              <TableCell className="text-right font-mono text-sm text-foreground">{r.popularity}</TableCell>
              <TableCell className="text-right font-mono text-sm text-muted-foreground">{r.priceCount}</TableCell>
              <TableCell className="text-center">
                <div className="flex justify-center">
                  <ValidSwitch row={r} />
                </div>
              </TableCell>
              <TableCell className="text-right">
                <EditTldDialog row={r} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
