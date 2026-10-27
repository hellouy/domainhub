import type React from "react"
import { redirect } from "next/navigation"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { adminLogout } from "@/app/actions/admin"
import { Button } from "@/components/ui/button"
import { AdminSidebar } from "@/components/admin/admin-nav"
import { getSiteSettings } from "@/lib/site-settings"
import { ExternalLink } from "lucide-react"

export const metadata = { title: "后台管理" }

/** 管理后台依赖 Cookie 认证与实时数据，禁止静态预渲染（否则构建时认证检查会失败） */
export const dynamic = "force-dynamic"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
  const s = await getSiteSettings()
  const brandName = `${s.brandTextMain}${s.brandTextAccent}${s.brandSuffix}`

  return (
    <div className="flex min-h-svh flex-col bg-background lg:flex-row">
      <AdminSidebar brandName={brandName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-border bg-card px-6 py-3">
          <span className="hidden text-sm font-medium text-muted-foreground lg:block">
            后台管理面板
          </span>
          <div className="flex items-center gap-3">
            <a
              href="/"
              target="_blank"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              前台
            </a>
            <form action={adminLogout}>
              <Button type="submit" variant="outline" size="sm">
                退出登录
              </Button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  )
}
