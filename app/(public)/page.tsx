import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { TldSearch } from "@/components/tld-search"
import { formatPrice, formatRelative } from "@/lib/format"
import { getActiveRegistrars, getStats, getTldsWithMinPrice } from "@/lib/db/queries"

export const revalidate = 300

export default async function HomePage() {
  const [stats, allTlds, registrarList] = await Promise.all([
    getStats(),
    getTldsWithMinPrice(),
    getActiveRegistrars(),
  ])
  const popularTlds = allTlds.filter((t) => t.isPopular)
  const searchOptions = allTlds.map((t) => ({
    tld: t.tld,
    type: t.type,
    minRegister: t.minRegister,
  }))

  return (
    <>
      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-16 md:px-6 md:py-24">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">全球域名价格聚合</p>
          <h1 className="max-w-3xl text-balance text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            注册域名前，
            <br />
            先比一次价。
          </h1>
          <p className="max-w-xl text-pretty leading-relaxed text-muted-foreground">
            DomainHub 汇集 {stats.registrarCount} 家主流注册商、{stats.tldCount} 个常用后缀的注册、续费与转入价格，
            让你避开首年低价陷阱，找到长期最划算的注册商。
          </p>
          <TldSearch options={searchOptions} />
          <dl className="flex flex-wrap gap-x-10 gap-y-4 border-t border-border pt-6">
            <div className="flex flex-col gap-1">
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">注册商</dt>
              <dd className="font-mono text-2xl font-semibold">{stats.registrarCount}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">域名后缀</dt>
              <dd className="font-mono text-2xl font-semibold">{stats.tldCount}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">价格记录</dt>
              <dd className="font-mono text-2xl font-semibold">{stats.priceCount}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">最近更新</dt>
              <dd className="font-mono text-2xl font-semibold">{formatRelative(stats.lastUpdated)}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* 热门后缀 */}
      <section aria-labelledby="popular-tlds" className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 md:px-6">
          <div className="mb-8 flex items-end justify-between">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-widest text-primary">01</p>
              <h2 id="popular-tlds" className="text-2xl font-bold tracking-tight md:text-3xl">
                热门后缀
              </h2>
            </div>
            <Link href="/tlds" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
              全部后缀
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-4">
            {popularTlds.map((t) => (
              <li key={t.id} className="bg-card">
                <Link
                  href={`/tld/${t.tld}`}
                  className="group flex h-full flex-col gap-4 p-5 transition-colors hover:bg-accent"
                >
                  <span className="font-mono text-xl font-semibold group-hover:text-primary">.{t.tld}</span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">最低注册价</span>
                    <span className="font-mono text-2xl font-semibold tabular-nums">
                      {formatPrice(t.minRegister)}
                    </span>
                    <span className="text-xs text-muted-foreground">{t.registrarCount} 家注册商</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 注册商 */}
      <section aria-labelledby="registrars-heading">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 md:px-6">
          <div className="mb-8 flex items-end justify-between">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-widest text-primary">02</p>
              <h2 id="registrars-heading" className="text-2xl font-bold tracking-tight md:text-3xl">
                收录的注册商
              </h2>
            </div>
            <Link
              href="/registrars"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
            >
              查看全部
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <ul className="flex flex-col border-t border-border">
            {registrarList.map((r, i) => (
              <li key={r.id} className="border-b border-border">
                <Link
                  href={`/registrars/${r.slug}`}
                  className="group flex flex-col gap-2 py-5 transition-colors hover:bg-accent md:flex-row md:items-center md:gap-6 md:px-2"
                >
                  <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="w-44 shrink-0 font-semibold group-hover:text-primary">{r.name}</span>
                  <span className="flex-1 truncate text-sm leading-relaxed text-muted-foreground">
                    {r.description}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{r.tldCount} 个后缀</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
