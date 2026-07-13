"use client"

import { TldSearch, type TldSearchOption } from "@/components/tld-search"
import { useLocale } from "@/components/providers"

type HeroStats = {
  registrarCount: number
  tldCount: number
  priceCount: number
  lastUpdatedText: string
}

/** 首页 Hero(客户端):文案随语言切换,数据由服务端传入 */
export function HomeHero({ stats, searchOptions }: { stats: HeroStats; searchOptions: TldSearchOption[] }) {
  const { t } = useLocale()

  const statItems = [
    { label: t("hero.stat.registrars"), value: String(stats.registrarCount) },
    { label: t("hero.stat.tlds"), value: String(stats.tldCount) },
    { label: t("hero.stat.prices"), value: String(stats.priceCount) },
    { label: t("hero.stat.updated"), value: stats.lastUpdatedText },
  ]

  return (
    <section className="border-b border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 md:gap-8 md:px-6 md:py-20">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">{t("hero.eyebrow")}</p>
        <h1 className="max-w-3xl text-balance text-3xl font-bold leading-tight tracking-tight md:text-6xl">
          {t("hero.title")}
        </h1>
        <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
          {t("hero.subtitle")
            .replace("{r}", String(stats.registrarCount))
            .replace("{t}", String(stats.tldCount))}
        </p>
        <TldSearch options={searchOptions} />
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 md:flex md:flex-wrap md:gap-x-10 md:gap-y-4 md:pt-6">
          {statItems.map((item) => (
            <div key={item.label} className="flex flex-col gap-0.5">
              <dt className="text-[10px] uppercase tracking-widest text-muted-foreground md:text-xs">
                {item.label}
              </dt>
              <dd className="font-mono text-lg font-semibold md:text-2xl">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
