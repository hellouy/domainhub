import type React from "react"
import { redirect } from "next/navigation"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { adminLogout } from "@/app/actions/admin"
import { Button } from "@/components/ui/button"
import { AdminSidebar } from "@/components/admin/admin-nav"
import { getSiteSettings } from "@/lib/site-settings"

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
        <header className="hidden items-center justify-end gap-2 border-b border-border bg-card px-6 py-3 lg:flex">
          <form action={adminLogout}>
            <Button type="submit" variant="outline" size="sm">
              退出登录
            </Button>
          </form>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  )
}
