"use client"

import Link from "next/link"
import { useLocale } from "@/components/providers"

type SiteFooterProps = {
  brandTextMain: string
  brandTextAccent: string
  brandSuffix: string
  logoUrl: string
  disclaimerZh: string
  disclaimerEn: string
}

export function SiteFooter({
  brandTextMain,
  brandTextAccent,
  brandSuffix,
  logoUrl,
  disclaimerZh,
  disclaimerEn,
}: SiteFooterProps) {
  const { t, locale } = useLocale()
  const brandName = `${brandTextMain}${brandTextAccent}${brandSuffix}`
  const disclaimer = locale === "en" ? disclaimerEn : disclaimerZh

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-start md:justify-between md:px-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={brandName} className="h-5 w-auto object-contain" />
            ) : (
              <span className="flex items-baseline font-mono text-sm font-semibold">
                {brandTextMain}
                <span className="text-primary">{brandTextAccent}</span>
                <span className="ml-0.5 rounded bg-primary px-1 text-xs text-primary-foreground">{brandSuffix}</span>
              </span>
            )}
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{t("footer.desc")}</p>
        </div>
        <nav aria-label={t("footer.nav")} className="flex gap-10">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {t("footer.browse")}
            </span>
            <Link href="/tlds" className="text-sm text-foreground hover:text-primary">
              {t("nav.tlds")}
            </Link>
            <Link href="/registrars" className="text-sm text-foreground hover:text-primary">
              {t("nav.registrars")}
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {t("footer.popular")}
            </span>
            <Link href="/tld/com" className="font-mono text-sm text-foreground hover:text-primary">
              .com
            </Link>
            <Link href="/tld/io" className="font-mono text-sm text-foreground hover:text-primary">
              .io
            </Link>
            <Link href="/tld/ai" className="font-mono text-sm text-foreground hover:text-primary">
              .ai
            </Link>
          </div>
        </nav>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <p className="text-xs text-muted-foreground">{disclaimer}</p>
          <p className="font-mono text-xs text-muted-foreground">{brandName}</p>
        </div>
      </div>
    </footer>
  )
}
