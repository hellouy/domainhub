"use client"

import Link from "next/link"
import { useI18n } from "@/lib/i18n/context"

export function SiteFooter() {
  const { dict } = useI18n()

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 md:flex-row md:items-start md:justify-between md:px-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex size-6 items-center justify-center rounded-lg bg-primary font-mono text-xs font-bold text-primary-foreground"
            >
              T
            </span>
            <span className="font-mono text-sm font-semibold">TLDbi</span>
          </div>
          <p className="max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
            {dict.footer.description}
          </p>
        </div>
        <nav aria-label="页脚导航" className="flex gap-10">
          <div className="flex flex-col gap-3">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {dict.footer.browse}
            </span>
            <Link href="/tlds" className="text-sm text-foreground transition-colors hover:text-primary">
              {dict.nav.allTlds}
            </Link>
            <Link href="/registrars" className="text-sm text-foreground transition-colors hover:text-primary">
              {dict.nav.registrars}
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {dict.footer.hotCompare}
            </span>
            <Link href="/compare/com" className="text-sm text-foreground transition-colors hover:text-primary">
              {dict.footer.compareCom}
            </Link>
            <Link href="/compare/io" className="text-sm text-foreground transition-colors hover:text-primary">
              {dict.footer.compareIo}
            </Link>
            <Link href="/compare/ai" className="text-sm text-foreground transition-colors hover:text-primary">
              {dict.footer.compareAi}
            </Link>
          </div>
        </nav>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <p className="text-pretty text-xs text-muted-foreground">{dict.footer.disclaimer}</p>
          <p className="font-mono text-xs text-muted-foreground">TLDbi</p>
        </div>
      </div>
    </footer>
  )
}
