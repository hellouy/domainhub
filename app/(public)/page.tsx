import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { HomeHero } from "@/components/home-hero"
import { SocialBadges } from "@/components/brand/social-badges"
import { ShareSection } from "@/components/brand/share-section"
import { TldExplorer } from "@/components/tld-explorer"
import { T, RegistrarDescription } from "@/components/i18n-text"
import { getActiveRegistrars, getStats, getTldsWithMinPrice } from "@/lib/db/queries"

export const revalidate = 300

export default async function HomePage() {
  const [stats, allTlds, registrarList] = await Promise.all([
    getStats(),
    getTldsWithMinPrice(),
    getActiveRegistrars(),
  ])

  const verifiedTlds = allTlds
    .filter((t) => t.registrarCount > 0 && t.minRegister !== null)
    .map((t) => ({
      tld: t.tld,
      type: t.type,
      isPopular: t.isPopular,
      minRegister: t.minRegister,
      registrarCount: t.registrarCount,
    }))

  const searchOptions = allTlds.map((t) => ({
    tld: t.tld,
    type: t.type,
    minRegister: t.minRegister,
  }))

  return (
    <>
      <HomeHero
        stats={{
          registrarCount: stats.registrarCount,
          tldCount: stats.tldCount,
          priceCount: stats.priceCount,
          lastUpdatedISO: stats.lastUpdated ? new Date(stats.lastUpdated).toISOString() : null,
        }}
        searchOptions={searchOptions}
      />

      <section className="border-b border-border bg-gradient-to-b from-background to-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">brand</p>
              <h2 className="text-xl font-semibold tracking-tight md:text-2xl">Trusted by domain investors and operators</h2>
            </div>
            <SocialBadges />
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm shadow-slate-200/40 dark:shadow-none">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary">01</p>
                  <h3 className="mt-2 text-lg font-semibold">Brand sharing</h3>
                </div>
              </div>
              <p className="mb-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Share the cheapest registration and renewal data across product communities, newsletters, and social platforms.
              </p>
              <ShareSection />
            </div>

            <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-background to-sky-100 p-5 dark:from-primary/10 dark:via-background dark:to-sky-950/30">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-sky-300 text-sm font-black text-primary-foreground">
                  D
                </span>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">tldbi</p>
                  <h3 className="font-semibold">Domain intelligence</h3>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {[
                  { label: 'TLDs', value: stats.tldCount.toLocaleString() },
                  { label: 'Registrars', value: stats.registrarCount.toLocaleString() },
                  { label: 'Quotes', value: stats.priceCount.toLocaleString() },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-border/80 bg-background/80 p-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{item.label}</div>
                    <div className="mt-2 font-mono text-xl font-semibold text-foreground">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="tld-explorer" className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6 md:py-14">
          <div className="mb-6 flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-widest text-primary">01</p>
            <h2 id="tld-explorer" className="text-xl font-bold tracking-tight md:text-3xl">
              <T k="section.explorer" />
            </h2>
          </div>
          <TldExplorer tlds={verifiedTlds} />
        </div>
      </section>

      <section aria-labelledby="registrars-heading">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6 md:py-14">
          <div className="mb-6 flex items-end justify-between">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-widest text-primary">02</p>
              <h2 id="registrars-heading" className="text-xl font-bold tracking-tight md:text-3xl">
                <T k="section.registrars" />
              </h2>
            </div>
            <Link
              href="/registrars"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
            >
              <T k="registrars.viewAll" />
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <ul className="grid grid-cols-1 gap-px border border-border bg-border md:grid-cols-2">
            {registrarList.map((r) => (
              <li key={r.id} className="bg-card">
                <Link
                  href={`/registrars/${r.slug}`}
                  className="group flex items-center gap-3 p-4 transition-colors hover:bg-accent"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold group-hover:text-primary">{r.name}</span>
                    <span className="block truncate text-xs leading-relaxed text-muted-foreground">
                      <RegistrarDescription slug={r.slug} fallback={r.description} />
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {r.tldCount} <T k="section.tldCount" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
