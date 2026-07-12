import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowUpRight } from "lucide-react"
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

      <section aria-label="最低价格" className="grid grid-cols-1 gap-px border border-border bg-border md:grid-cols-3">
        {[
          { label: "最低注册价", value: minRegister, note: "首年" },
          { label: "最低续费价", value: minRenew, note: "每年" },
          { label: "最低转入价", value: minTransfer, note: "含一年续期" },
        ].map((item) => (
          <div key={item.label} className="flex flex-col gap-2 bg-card p-6">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">{item.label}</span>
            <span className="font-mono text-3xl font-bold tabular-nums text-primary">
              {item.value != null ? formatPrice(item.value) : "—"}
            </span>
            <span className="text-xs text-muted-foreground">{item.note} · USD</span>
          </div>
        ))}
      </section>

      <section aria-labelledby="price-list" className="flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <h2 id="price-list" className="text-xl font-bold tracking-tight">
            全部注册商价格（{priceRows.length}）
          </h2>
          <Link
            href={`/compare/${row.tld}`}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
          >
            完整比价
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
        <PriceTable rows={priceRows} />
      </section>
    </div>
  )
}
