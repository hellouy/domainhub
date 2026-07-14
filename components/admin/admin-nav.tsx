"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Store,
  Radio,
  DollarSign,
  Globe,
  KeyRound,
  DatabaseBackup,
  Settings,
  Menu,
  X,
  ExternalLink,
  LogOut,
} from "lucide-react"
import { adminLogout } from "@/app/actions/admin"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/admin", label: "概览", icon: LayoutDashboard, exact: true },
  { href: "/admin/registrars", label: "注册商", icon: Store },
  { href: "/admin/crawls", label: "采集任务", icon: Radio },
  { href: "/admin/prices", label: "价格数据", icon: DollarSign },
  { href: "/admin/tlds", label: "后缀管理", icon: Globe },
  { href: "/admin/credentials", label: "凭证", icon: KeyRound },
  { href: "/admin/replication", label: "数据容灾", icon: DatabaseBackup },
  { href: "/admin/settings", label: "站点设置", icon: Settings },
]

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="后台导航" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href, item.exact)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function AdminSidebar({ brandName }: { brandName: string }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* 移动端顶栏 */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
        <Link href="/admin" className="font-mono text-sm font-semibold tracking-widest text-primary">
          {brandName} 后台
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex size-9 items-center justify-center rounded-md border border-border text-foreground hover:bg-accent"
          aria-label="打开导航菜单"
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </div>

      {/* 移动端抽屉 */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-0 flex h-full w-64 flex-col gap-4 bg-card p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold tracking-widest text-primary">
                {brandName} 后台
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                aria-label="关闭导航菜单"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
            <div className="mt-auto flex flex-col gap-1">
              <Link
                href="/"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <ExternalLink className="size-4" aria-hidden />
                返回前台
              </Link>
              <form action={adminLogout}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <LogOut className="size-4" aria-hidden />
                  退出登录
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {/* 桌面端固定侧边栏 */}
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col gap-4 border-r border-border bg-card p-4 lg:flex">
        <Link
          href="/admin"
          className="flex items-center gap-2 px-2 py-1 font-mono text-sm font-semibold tracking-widest text-primary"
        >
          {brandName} 后台
        </Link>
        <NavLinks pathname={pathname} />
        <Link
          href="/"
          className="mt-auto flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <ExternalLink className="size-4" aria-hidden />
          返回前台
        </Link>
      </aside>
    </>
  )
}
