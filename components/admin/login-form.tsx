"use client"

import { useActionState } from "react"
import { adminLogin } from "@/app/actions/admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(adminLogin, null)

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">管理员密码</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          placeholder="请输入密码"
          autoComplete="current-password"
        />
      </div>
      {state?.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "登录中…" : "登录"}
      </Button>
    </form>
  )
}
