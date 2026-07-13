import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { TldSearch } from "@/components/tld-search"
import { TldExplorer } from "@/components/tld-explorer"
import { formatRelative } from "@/lib/format"
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
      {/* Hero：移动端紧凑，统计 2x2 */}
      <section className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 md:gap-8 md:px-6 md:py-20">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">全球域名价格聚合</p>
          <h1 className="max-w-3xl text-balance text-3xl font-bold leading-tight tracking-tight md:text-6xl">
            注册域名前，先比一次价。
          </h1>
          <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
            汇集 {stats.registrarCount} 家注册商、{stats.tldCount} 个后缀的注册、续费与转入价格，
            避开首年低价陷阱。
          </p>
          <TldSearch options={searchOptions} />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 md:flex md:flex-wrap md:gap-x-10 md:gap-y-4 md:pt-6">
            {[
              { label: "注册商", value: String(stats.registrarCount) },
              { label: "域名后缀", value: String(stats.tldCount) },
              { label: "价格记录", value: String(stats.priceCount) },
              { label: "最近更新", value: formatRelative(stats.lastUpdated) },
            ].map((item) => (
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

      {/* 后缀浏览器：筛选 + 点击就地看价，零跳转 */}
      <section aria-labelledby="tld-explorer" className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6 md:py-14">
          <div className="mb-6 flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-widest text-primary">01</p>
            <h2 id="tld-explorer" className="text-xl font-bold tracking-tight md:text-3xl">
              浏览后缀价格
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
                      {r.description}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{r.tldCount} 后缀</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
