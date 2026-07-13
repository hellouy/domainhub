"use client"

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { PopularTldGrid } from "@/components/home/popular-tld-grid"
import { TldSearch } from "@/components/tld-search"
import type { PopularTldWithPrices } from "@/lib/db/queries"
import { interpolate, useI18n } from "@/lib/i18n/context"

type Stats = {
  registrarCount: number
  tldCount: number
  priceCount: number
  lastUpdated: string | null
}

type RegistrarItem = {
  id: number
  slug: string
  name: string
  description: string | null
  tldCount: number
}

type SearchOption = {
  tld: string
  type: string
  minRegister: string | null
}

/** 本地化相对时间（避免服务端中文串硬编码） */
function useRelative(value: string | null) {
  const { locale } = useI18n()
  if (!value) return "—"
  const diff = Date.now() - new Date(value).getTime()
  const rtf = new Intl.RelativeTimeFormat(locale === "en" ? "en" : "zh-CN", { numeric: "auto" })
  const minutes = Math.round(diff / 60000)
  if (minutes < 60) return rtf.format(-minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (hours < 24) return rtf.format(-hours, "hour")
  const days = Math.round(hours / 24)
  return rtf.format(-days, "day")
}

export function HomeContent({
  stats,
  popularTlds,
  registrars,
  searchOptions,
}: {
  stats: Stats
  popularTlds: PopularTldWithPrices[]
  registrars: RegistrarItem[]
  searchOptions: SearchOption[]
}) {
  const { dict } = useI18n()
  const t = dict.home
  const relativeUpdated = useRelative(stats.lastUpdated)

  const statItems = [
    { label: t.statRegistrars, value: stats.registrarCount },
    { label: t.statTlds, value: stats.tldCount },
    { label: t.statPrices, value: stats.priceCount },
    { label: t.statUpdated, value: relativeUpdated },
  ]

  return (
    <>
      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-secondary/40 to-transparent">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 py-14 md:px-6 md:py-20">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">{t.heroKicker}</p>
          <h1 className="max-w-3xl text-balance text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl">
            {t.heroTitleLine1}
            <br />
            {t.heroTitleLine2}
          </h1>
          <p className="max-w-xl text-pretty leading-relaxed text-muted-foreground">
            {interpolate(t.heroDescription, {
              registrars: stats.registrarCount,
              tlds: stats.tldCount,
            })}
          </p>
          <TldSearch options={searchOptions} />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-border pt-6 sm:grid-cols-4">
            {statItems.map((item) => (
              <div key={item.label} className="flex flex-col gap-1">
                <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">{item.label}</dt>
                <dd className="font-mono text-2xl font-semibold tabular-nums">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 热门后缀（内联展开比价） */}
      <section aria-labelledby="popular-tlds" className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 md:px-6 md:py-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-widest text-primary">01</p>
              <h2 id="popular-tlds" className="text-2xl font-bold tracking-tight md:text-3xl">
                {t.popularTitle}
              </h2>
              <p className="text-sm text-muted-foreground">{t.popularHint}</p>
            </div>
            <Link
              href="/tlds"
              className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              {dict.common.viewAll}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <PopularTldGrid tlds={popularTlds} />
        </div>
      </section>

      {/* 注册商 */}
      <section aria-labelledby="registrars-heading">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 md:px-6 md:py-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-widest text-primary">02</p>
              <h2 id="registrars-heading" className="text-2xl font-bold tracking-tight md:text-3xl">
                {t.registrarsTitle}
              </h2>
            </div>
            <Link
              href="/registrars"
              className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              {dict.common.viewAll}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {registrars.map((r, i) => (
              <li key={r.id}>
                <Link
                  href={`/registrars/${r.slug}`}
                  className="group flex h-full items-start gap-4 rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-sm active:scale-[0.99]"
                >
                  <span className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex flex-1 flex-col gap-1">
                    <span className="font-semibold transition-colors group-hover:text-primary">{r.name}</span>
                    <span className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {r.description}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {r.tldCount} {dict.common.tldsUnit}
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
