import type React from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { adminLogout } from "@/app/actions/admin"
import { Button } from "@/components/ui/button"
import { getSiteSettings } from "@/lib/site-settings"

export const metadata = { title: "后台管理" }

/** 管理后台依赖 Cookie 认证与实时数据，禁止静态预渲染（否则构建时认证检查会失败） */
export const dynamic = "force-dynamic"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
  const s = await getSiteSettings()
  const brandName = `${s.brandTextMain}${s.brandTextAccent}${s.brandSuffix}`

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="font-mono text-sm font-semibold tracking-widest text-primary">
              {brandName} 后台
            </Link>
            <nav aria-label="后台导航" className="flex items-center gap-1 text-sm">
              <Link href="/admin" className="rounded px-2 py-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                概览
              </Link>
              <Link
                href="/admin/registrars"
                className="rounded px-2 py-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                注册商
              </Link>
              <Link
                href="/admin/crawls"
                className="rounded px-2 py-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                采集任务
              </Link>
              <Link
                href="/admin/credentials"
                className="rounded px-2 py-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                凭证
              </Link>
              <Link
                href="/admin/settings"
                className="rounded px-2 py-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                站点设置
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              返回前台
            </Link>
            <form action={adminLogout}>
              <Button type="submit" variant="outline" size="sm">
                退出登录
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  )
}
