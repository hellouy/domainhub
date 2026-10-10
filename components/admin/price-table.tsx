"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Trash2, ExternalLink } from "lucide-react"
import { updatePriceAction, deletePriceAction } from "@/app/actions/prices"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatPrice, formatRelative } from "@/lib/format"

export type PriceRow = {
  priceId: number
  registrarName: string
  registrarSlug: string
  tld: string
  registerPrice: string | null
  renewPrice: string | null
  transferPrice: string | null
  promotionPrice: string | null
  promoCode: string | null
  promoCodes: { code: string; promotionPrice?: string | null; promotionEndsAt?: string | null; sourceUrl?: string | null }[] | null
  promotionEndsAt: Date | string | null
  currency: string
  sourceUrl: string | null
  updatedAt: Date | string | null
}

function EditPriceDialog({ row }: { row: PriceRow }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) setError(null)
      }}
    >
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" aria-label={`编辑 ${row.tld} 价格`}>
            <Pencil className="size-3.5" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            纠正价格 · {row.tld}
          </DialogTitle>
          <DialogDescription>
            {row.registrarName} — 保存前会自动把旧值存入历史，可追溯。
          </DialogDescription>
        </DialogHeader>
        <form
          action={(formData) =>
            startTransition(async () => {
              setError(null)
              try {
                await updatePriceAction(row.priceId, formData)
                setOpen(false)
                router.refresh()
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "保存失败，请重试。")
              }
            })
          }
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`reg-${row.priceId}`}>注册价</Label>
              <Input
                id={`reg-${row.priceId}`}
                name="registerPrice"
                type="number"
                step="0.01"
                min="0"
                defaultValue={row.registerPrice ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`cur-${row.priceId}`}>币种</Label>
              <Input id={`cur-${row.priceId}`} name="currency" defaultValue={row.currency} maxLength={3} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`ren-${row.priceId}`}>续费价</Label>
              <Input
                id={`ren-${row.priceId}`}
                name="renewPrice"
                type="number"
                step="0.01"
                min="0"
                defaultValue={row.renewPrice ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`tra-${row.priceId}`}>转入价</Label>
              <Input
                id={`tra-${row.priceId}`}
                name="transferPrice"
                type="number"
                step="0.01"
                min="0"
                defaultValue={row.transferPrice ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`promo-${row.priceId}`}>优惠价（可留空）</Label>
              <Input
                id={`promo-${row.priceId}`}
                name="promotionPrice"
                type="number"
                step="0.01"
                min="0"
                defaultValue={row.promotionPrice ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`promo-code-${row.priceId}`}>优惠码（可留空）</Label>
              <Input
                id={`promo-code-${row.priceId}`}
                name="promoCode"
                maxLength={120}
                defaultValue={row.promoCode ?? ""}
                autoComplete="off"
              />
            </div>
            <div className="col-span-2 flex flex-col gap-2">
              <Label htmlFor={`promo-codes-${row.priceId}`}>
                多优惠码（每行一个 CODE 或 CODE,price[,YYYY-MM-DD][,url]，与上方单码互斥）
              </Label>
              <textarea
                id={`promo-codes-${row.priceId}`}
                name="promoCodes"
                rows={3}
                defaultValue={
                  row.promoCodes && row.promoCodes.length > 0
                    ? row.promoCodes
                        .map((c) =>
                          [c.code, c.promotionPrice ?? "", c.promotionEndsAt ? new Date(c.promotionEndsAt).toISOString().slice(0, 10) : "", c.sourceUrl ?? ""].filter((f, i) => f !== "" || i === 0).join(","),
                        )
                        .join("\n")
                    : ""
                }
                autoComplete="off"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm"
              />
            </div>
            <div className="col-span-2 flex flex-col gap-2">
              <Label htmlFor={`promo-end-${row.priceId}`}>优惠截止日期（可留空）</Label>
              <Input
                id={`promo-end-${row.priceId}`}
                name="promotionEndsAt"
                type="date"
                defaultValue={row.promotionEndsAt ? new Date(row.promotionEndsAt).toISOString().slice(0, 10) : ""}
              />
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
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

function DeletePriceButton({ row }: { row: PriceRow }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-label={`删除 ${row.tld} 价格`}
      onClick={() => {
        if (!confirm(`确定删除 ${row.registrarName} 的 ${row.tld} 价格？`)) return
        startTransition(async () => {
          await deletePriceAction(row.priceId)
          router.refresh()
        })
      }}
    >
      <Trash2 className="size-3.5 text-destructive" />
    </Button>
  )
}

export function PriceTable({ rows }: { rows: PriceRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>后缀</TableHead>
            <TableHead>注册商</TableHead>
            <TableHead className="text-right">注册价</TableHead>
            <TableHead className="text-right">续费价</TableHead>
            <TableHead className="text-right">转入价</TableHead>
            <TableHead>优惠</TableHead>
            <TableHead>更新</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.priceId}>
              <TableCell className="font-mono font-medium text-foreground">{r.tld}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-foreground">{r.registrarName}</span>
                  {r.sourceUrl ? (
                    <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label="数据来源">
                      <ExternalLink className="size-3 text-muted-foreground hover:text-primary" />
                    </a>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-right font-mono text-sm text-foreground">
                {formatPrice(r.registerPrice, r.currency)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm text-muted-foreground">
                {formatPrice(r.renewPrice, r.currency)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm text-muted-foreground">
                {formatPrice(r.transferPrice, r.currency)}
              </TableCell>
              <TableCell>
                {r.promotionPrice !== null ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-sm font-medium text-primary">
                      {formatPrice(r.promotionPrice, r.currency)}
                    </span>
                    {r.promoCode && <code className="font-mono text-xs text-muted-foreground">{r.promoCode}</code>}
                    {r.promoCodes && r.promoCodes.length > 1 && (
                      <code className="font-mono text-[10px] text-muted-foreground">
                        +{r.promoCodes.length - 1} 个码
                      </code>
                    )}
                  </div>
                ) : r.promoCodes && r.promoCodes.length > 0 ? (
                  <div className="flex flex-col gap-0.5">
                    <code className="font-mono text-xs text-muted-foreground">{r.promoCodes[0].code}</code>
                    {r.promoCodes.length > 1 && (
                      <code className="font-mono text-[10px] text-muted-foreground">+{r.promoCodes.length - 1} 个码</code>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <span className="text-xs text-muted-foreground">{formatRelative(r.updatedAt)}</span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-0.5">
                  <EditPriceDialog row={r} />
                  <DeletePriceButton row={r} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
