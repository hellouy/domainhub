import type { Metadata } from "next"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { T, TCount, RegistrarDescription } from "@/components/i18n-text"
import { getActiveRegistrars } from "@/lib/db/queries"

export const revalidate = 300

export const metadata: Metadata = {
  title: "域名注册商大全",
  description: "浏览 tldbi.com 收录的全球主流域名注册商，了解各家的特色、支持的后缀数量与价格水平。",
  alternates: { canonical: "/registrars" },
}

export default async function RegistrarsPage() {
  const rows = await getActiveRegistrars()

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 md:px-6">
      <header className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">
          <T k="nav.registrars" />
        </p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          <T k="page.registrars.title" />
        </h1>
        <p className="max-w-2xl leading-relaxed text-muted-foreground">
          <TCount k="page.registrars.desc" vars={{ n: rows.length }} />
        </p>
      </header>
      <ul className="grid grid-cols-1 gap-px border border-border bg-border md:grid-cols-2">
        {rows.map((r) => (
          <li key={r.id} className="bg-card">
            <Link
              href={`/registrars/${r.slug}`}
              className="group flex h-full flex-col gap-3 p-6 transition-colors hover:bg-accent"
            >
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold group-hover:text-primary">{r.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {r.tldCount} <T k="section.tldCount" />
                </span>
              </div>
              <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                <RegistrarDescription slug={r.slug} fallback={r.description} />
              </p>
              <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                {r.icannAccredited && (
                  <Badge variant="secondary">
                    <T k="badge.icann" />
                  </Badge>
                )}
                {r.whoisPrivacy && (
                  <Badge variant="secondary">
                    <T k="badge.whois" />
                  </Badge>
                )}
                {r.dnssec && (
                  <Badge variant="secondary">
                    <T k="badge.dnssec" />
                  </Badge>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
