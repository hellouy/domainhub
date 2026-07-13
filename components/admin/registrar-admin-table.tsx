"use client"

import { useState, useTransition } from "react"
import { toggleRegistrarActive, updateRegistrar } from "@/app/actions/admin"
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
import { CrawlOneButton } from "@/components/admin/crawl-buttons"
import { useRouter } from "next/navigation"

type Registrar = {
  id: number
  slug: string
  name: string
  website: string
  description: string
  isActive: boolean
}

function ActiveSwitch({ registrar }: { registrar: Registrar }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  return (
    <Switch
      checked={registrar.isActive}
      disabled={pending}
      aria-label={`${registrar.name} 启用状态`}
      onCheckedChange={(checked) =>
        startTransition(async () => {
          await toggleRegistrarActive(registrar.id, checked)
          router.refresh()
        })
      }
    />
  )
}

function EditDialog({ registrar }: { registrar: Registrar }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            编辑
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑注册商</DialogTitle>
          <DialogDescription>修改 {registrar.name} 的基本信息。</DialogDescription>
        </DialogHeader>
        <form
          action={(formData) =>
            startTransition(async () => {
              await updateRegistrar(registrar.id, formData)
              setOpen(false)
              router.refresh()
            })
          }
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={`name-${registrar.id}`}>名称</Label>
            <Input id={`name-${registrar.id}`} name="name" defaultValue={registrar.name} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`website-${registrar.id}`}>官网地址</Label>
            <Input id={`website-${registrar.id}`} name="website" type="url" defaultValue={registrar.website} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`description-${registrar.id}`}>简介</Label>
            <Input id={`description-${registrar.id}`} name="description" defaultValue={registrar.description} />
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

export function RegistrarAdminTable({ registrars }: { registrars: Registrar[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>注册商</TableHead>
            <TableHead>官网</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>启用</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {registrars.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium text-foreground">{r.name}</TableCell>
              <TableCell>
                <a
                  href={r.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  {r.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </a>
              </TableCell>
              <TableCell>
                <Badge variant={r.isActive ? "default" : "secondary"}>{r.isActive ? "已启用" : "已禁用"}</Badge>
              </TableCell>
              <TableCell>
                <ActiveSwitch registrar={r} />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-start justify-end gap-1">
                  <CrawlOneButton
                    registrarId={r.id}
                    label={r.slug === "cloudflare" ? "运行 Cloudflare 采集" : undefined}
                  />
                  <EditDialog registrar={r} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
