import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { HomeHero } from "@/components/home-hero"
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
  /** 已验证后缀：至少有一条真实采集价格记录 */
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
      {/* Hero：移动端紧凑，统计 2x2，文案随语言切换 */}
      <HomeHero
        stats={{
          registrarCount: stats.registrarCount,
          tldCount: stats.tldCount,
          priceCount: stats.priceCount,
          lastUpdatedISO: stats.lastUpdated ? new Date(stats.lastUpdated).toISOString() : null,
        }}
        searchOptions={searchOptions}
      />

      {/* 后缀浏览器：筛选 + 点击就地看价，零跳转 */}
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

      {/* 注册商：移动端紧凑双行 */}
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
