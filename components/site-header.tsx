"use client"

import Link from "next/link"
import { CurrencyToggle, LocaleToggle, ThemeToggle } from "@/components/header-toggles"
import { useLocale } from "@/components/providers"

export function SiteHeader() {
  const { t } = useLocale()

  const navItems = [
    { href: "/tlds", label: t("nav.tlds") },
    { href: "/registrars", label: t("nav.registrars") },
  ]

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex size-6 items-center justify-center rounded bg-primary font-mono text-sm font-bold text-primary-foreground"
          >
            t.
          </span>
          <span className="font-mono text-sm font-semibold tracking-tight">tldbi.com</span>
        </Link>
        <div className="flex items-center gap-0.5">
          <nav aria-label="主导航" className="flex items-center">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground md:px-3"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <CurrencyToggle />
          <LocaleToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
