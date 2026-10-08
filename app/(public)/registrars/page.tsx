import type { Metadata } from "next"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { T, TCount, RegistrarDescription } from "@/components/i18n-text"
import { RegistrarIcon } from "@/components/registrar-favicon"
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
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {rows.map((r) => (
          <li key={r.id} className="min-w-0">
            <Link
              href={`/registrars/${r.slug}`}
              className="group flex h-full min-h-32 items-start gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-offset-4 sm:p-5"
            >
              <RegistrarIcon slug={r.slug} name={r.name} />
              <div className="flex min-w-0 flex-1 flex-col gap-3 self-stretch">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 truncate text-lg font-semibold tracking-tight transition-colors group-hover:text-primary">
                    {r.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-primary">
                      {r.score} <T k="registrar.score" />
                    </span>
                    <span className="text-right font-mono text-sm tabular-nums text-foreground">
                      {r.tldCount}
                      <span className="block text-xs font-sans font-normal text-muted-foreground">
                        <T k="section.tldCount" />
                      </span>
                    </span>
                  </span>
                </div>
                <RegistrarDescription
                  slug={r.slug}
                  fallback={r.description}
                  className="line-clamp-3 text-sm leading-relaxed text-muted-foreground"
                />
                <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
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
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
