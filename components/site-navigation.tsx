"use client"

import Link from "next/link"
import { BadgePercent, Globe2, Store } from "lucide-react"
import { useLocale } from "@/components/providers"

const links = [
  { href: "/tlds", label: "nav.tlds", Icon: Globe2 },
  { href: "/registrars", label: "nav.registrars", Icon: Store },
  { href: "/deals", label: "nav.deals", Icon: BadgePercent },
] as const

export function SiteNavigation() {
  const { t } = useLocale()

  return (
    <nav aria-label={t("footer.nav")} className="flex items-center gap-0.5">
      {links.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-label={t(label)}
          title={t(label)}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:h-9 sm:w-auto sm:gap-1.5 sm:px-2 sm:text-sm"
        >
          <Icon aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">{t(label)}</span>
        </Link>
      ))}
    </nav>
  )
}
