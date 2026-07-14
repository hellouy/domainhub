import { redirect } from "next/navigation"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { AdminLoginForm } from "@/components/admin/login-form"
import { getSiteSettings } from "@/lib/site-settings"

export const metadata = { title: "后台登录" }

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) redirect("/admin")
  const s = await getSiteSettings()
  const brandName = `${s.brandTextMain}${s.brandTextAccent}${s.brandSuffix}`

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-mono text-sm font-semibold tracking-widest text-primary">{brandName}</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground">后台管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">请输入管理员密码以继续</p>
        </div>
        <AdminLoginForm />
      </div>
    </main>
  )
}
