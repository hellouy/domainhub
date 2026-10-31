"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BadgePercent, Globe2, House, Mail, Newspaper, Store } from "lucide-react"
import { useLocale } from "@/components/providers"
import { cn } from "@/lib/utils"

const links = [
  { href: "/tlds", label: "nav.tlds", Icon: Globe2, match: ["/tlds", "/tld/"] },
  { href: "/registrars", label: "nav.registrars", Icon: Store, match: ["/registrars"] },
  { href: "/deals", label: "nav.deals", Icon: BadgePercent, match: ["/deals"] },
  { href: "/articles", label: "nav.articles", Icon: Newspaper, match: ["/articles"] },
  { href: "/contact", label: "nav.contact", Icon: Mail, match: ["/contact"] },
] as const

const tabs = [{ href: "/", label: "nav.home", Icon: House, match: [] as readonly string[] }, ...links] as const

function isActive(pathname: string, href: string, match: readonly string[]) {
  if (href === "/") return pathname === "/"
  return match.some((m) => pathname === m || pathname.startsWith(m.endsWith("/") ? m : `${m}/`))
}

/** 桌面端顶部内联导航;移动端由底部标签栏承担 */
export function SiteNavigation() {
  const { t } = useLocale()
  const pathname = usePathname()

  return (
    <nav aria-label={t("footer.nav")} className="hidden items-center gap-1 md:flex">
      {links.map(({ href, label, Icon, match }) => {
        const active = isActive(pathname, href, match)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-md px-3 text-sm transition-colors",
              active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            {t(label)}
          </Link>
        )
      })}
    </nav>
  )
}

/** 移动端底部标签栏:单手可达,激活态清晰,适配 iPhone 底部安全区 */
export function MobileTabBar() {
  const { t } = useLocale()
  const pathname = usePathname()

  return (
    <nav
      aria-label={t("footer.nav")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto grid h-14 max-w-md grid-cols-6">
        {tabs.map(({ href, label, Icon, match }) => {
          const active = isActive(pathname, href, match)
          return (
            <li key={href} className="flex">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "tab-item relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] leading-none transition-colors",
                  active ? "font-medium text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-200",
                    active && "bg-primary/10",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                </span>
                {t(label)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
