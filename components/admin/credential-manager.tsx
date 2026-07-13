"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createCredential, deleteCredential, toggleCredential } from "@/app/actions/credentials"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const TYPE_LABELS: Record<string, string> = {
  api_key: "API Key",
  bearer: "Bearer Token",
  cookie: "Cookie",
  session: "Session",
  basic: "Basic Auth",
  custom_header: "自定义请求头",
}

export interface CredentialRow {
  id: number
  registrarId: number
  registrarName: string
  registrarSlug: string
  type: string
  label: string
  masked: Record<string, string>
  isActive: boolean
  createdAt: string
}

export interface RegistrarOption {
  id: number
  name: string
}

function AddCredentialDialog({ registrarOptions }: { registrarOptions: RegistrarOption[] }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState("api_key")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">添加凭证</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加注册商凭证</DialogTitle>
          <DialogDescription>凭证使用 AES-256-GCM 加密存储, 保存后仅显示脱敏值。</DialogDescription>
        </DialogHeader>
        <form
          action={(formData) =>
            startTransition(async () => {
              setError(null)
              try {
                await createCredential(formData)
                setOpen(false)
                router.refresh()
              } catch (err) {
                setError(err instanceof Error ? err.message : "保存失败")
              }
            })
          }
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="cred-registrar">注册商</Label>
            <select
              id="cred-registrar"
              name="registrarId"
              required
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              {registrarOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cred-type">类型</Label>
            <select
              id="cred-type"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cred-label">标签(可选)</Label>
            <Input id="cred-label" name="label" placeholder="如: 生产 API Key" />
          </div>

          {(type === "api_key" || type === "bearer") && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="cred-token">Token</Label>
              <Input id="cred-token" name="token" type="password" required autoComplete="off" />
            </div>
          )}
          {type === "basic" && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cred-username">用户名</Label>
                <Input id="cred-username" name="username" required autoComplete="off" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cred-password">密码</Label>
                <Input id="cred-password" name="password" type="password" required autoComplete="off" />
              </div>
            </>
          )}
          {(type === "cookie" || type === "session") && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="cred-cookie">Cookie</Label>
              <Input id="cred-cookie" name="cookie" type="password" required autoComplete="off" />
            </div>
          )}
          {type === "custom_header" && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cred-header-name">请求头名称</Label>
                <Input id="cred-header-name" name="headerName" placeholder="X-Api-Token" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cred-header-value">请求头值</Label>
                <Input id="cred-header-value" name="headerValue" type="password" required autoComplete="off" />
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
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

function CredentialActiveSwitch({ row }: { row: CredentialRow }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  return (
    <Switch
      checked={row.isActive}
      disabled={pending}
      aria-label={`${row.label} 启用状态`}
      onCheckedChange={(checked) =>
        startTransition(async () => {
          await toggleCredential(row.id, checked)
          router.refresh()
        })
      }
    />
  )
}

function DeleteButton({ row }: { row: CredentialRow }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`确认删除凭证「${row.label}」? 此操作不可恢复。`)) return
        startTransition(async () => {
          await deleteCredential(row.id)
          router.refresh()
        })
      }}
    >
      {pending ? "删除中…" : "删除"}
    </Button>
  )
}

export function CredentialManager({
  credentials,
  registrarOptions,
}: {
  credentials: CredentialRow[]
  registrarOptions: RegistrarOption[]
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {credentials.length > 0 ? `共 ${credentials.length} 条凭证` : "暂无凭证"}
        </p>
        <AddCredentialDialog registrarOptions={registrarOptions} />
      </div>
      {credentials.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>注册商</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>标签</TableHead>
                <TableHead>值(脱敏)</TableHead>
                <TableHead>启用</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {credentials.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium text-foreground">{row.registrarName}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{TYPE_LABELS[row.type] ?? row.type}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.label}</TableCell>
                  <TableCell>
                    <code className="font-mono text-xs text-muted-foreground">
                      {Object.values(row.masked).join(" / ")}
                    </code>
                  </TableCell>
                  <TableCell>
                    <CredentialActiveSwitch row={row} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DeleteButton row={row} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
