import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { PriceTable } from "@/components/price-table"
import { formatPrice, formatRelative, TLD_TYPE_LABELS } from "@/lib/format"
import { getPricesForTld, getTldByName, getTldLastUpdated } from "@/lib/db/queries"

export const revalidate = 300

type Props = { params: Promise<{ tld: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tld } = await params
  const row = await getTldByName(decodeURIComponent(tld))
  if (!row) return { title: "未找到该后缀" }
  return {
    title: `.${row.tld} 域名价格比较 — 注册、续费、转入最低价`,
    description: `比较各大注册商的 .${row.tld} 域名注册、续费与转入价格，实时找到最便宜的 .${row.tld} 注册商。${row.description.slice(0, 60)}`,
    alternates: { canonical: `/tld/${row.tld}` },
    openGraph: {
      title: `.${row.tld} 域名价格比较`,
      description: `找到最便宜的 .${row.tld} 域名注册商`,
    },
  }
}

function minOf(values: (string | null)[]) {
  const nums = values
    .filter((v): v is string => v != null)
    .map((v) => Number.parseFloat(v))
    .filter((v) => !Number.isNaN(v))
  return nums.length > 0 ? Math.min(...nums) : null
}

export default async function TldPage({ params }: Props) {
  const { tld } = await params
  const row = await getTldByName(decodeURIComponent(tld))
  if (!row) notFound()

  const [priceRows, lastUpdated] = await Promise.all([getPricesForTld(row.id), getTldLastUpdated(row.id)])

  const minRegister = minOf(priceRows.map((p) => p.registerPrice))
  const minRenew = minOf(priceRows.map((p) => p.renewPrice))
  const minTransfer = minOf(priceRows.map((p) => p.transferPrice))

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `.${row.tld} 域名`,
    description: row.description,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: minRegister ?? undefined,
      offerCount: priceRows.length,
    },
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 md:px-6">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="面包屑" className="text-xs text-muted-foreground">
        <Link href="/" className="hover:text-primary">
          首页
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href="/tlds" className="hover:text-primary">
          全部后缀
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">.{row.tld}</span>
      </nav>

      <header className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">
          {TLD_TYPE_LABELS[row.type] ?? row.type}
        </p>
        <h1 className="font-mono text-4xl font-bold tracking-tight md:text-5xl">.{row.tld}</h1>
        <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">{row.description}</p>
        <p className="text-xs text-muted-foreground">数据更新于 {formatRelative(lastUpdated)}</p>
      </header>

      <section aria-label="最低价格" className="grid grid-cols-3 gap-px border border-border bg-border">
        {[
          { label: "最低注册", value: minRegister, note: "首年" },
          { label: "最低续费", value: minRenew, note: "每年" },
          { label: "最低转入", value: minTransfer, note: "含续期" },
        ].map((item) => (
          <div key={item.label} className="flex flex-col gap-1 bg-card p-3 md:gap-2 md:p-6">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground md:text-xs md:tracking-widest">
              {item.label}
            </span>
            <span className="font-mono text-lg font-bold tabular-nums text-primary md:text-3xl">
              {item.value != null ? formatPrice(item.value) : "—"}
            </span>
            <span className="text-[10px] text-muted-foreground md:text-xs">{item.note} · USD</span>
          </div>
        ))}
      </section>

      <section aria-labelledby="price-list" className="flex flex-col gap-4">
        <h2 id="price-list" className="text-xl font-bold tracking-tight">
          全部注册商价格（{priceRows.length}）
        </h2>
        <PriceTable rows={priceRows} />
        <p className="text-xs leading-relaxed text-muted-foreground">
          提示：许多注册商首年注册价低廉，但续费明显更高。若计划长期持有，请重点比较续费价。
        </p>
      </section>
    </div>
  )
}
