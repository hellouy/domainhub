import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { PriceTable } from "@/components/price-table"
import { Money } from "@/components/money"
import { T, TldType, DataUpdated } from "@/components/i18n-text"
import { getPricesForTld, getTldByName, getTldLastUpdated } from "@/lib/db/queries"
import { getUsdRates, toUsd, type UsdRates } from "@/lib/fx"

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

/** 跨币种最低价:全部折算 USD 后比较,排除 < $1 的促销占位价 */
function minUsdOf(values: { value: string | null; currency: string }[], rates: UsdRates) {
  const nums = values
    .filter((v): v is { value: string; currency: string } => v.value != null)
    .map((v) => toUsd(Number.parseFloat(v.value), v.currency, rates))
    .filter((v) => !Number.isNaN(v) && v >= 1)
  return nums.length > 0 ? Math.min(...nums) : null
}

export default async function TldPage({ params }: Props) {
  const { tld } = await params
  const row = await getTldByName(decodeURIComponent(tld))
  if (!row) notFound()

  const [priceRows, lastUpdated, rates] = await Promise.all([
    getPricesForTld(row.id),
    getTldLastUpdated(row.id),
    getUsdRates(),
  ])

  const minRegister = minUsdOf(
    priceRows.map((p) => ({ value: p.registerPrice, currency: p.currency })),
    rates,
  )
  const minRenew = minUsdOf(
    priceRows.map((p) => ({ value: p.renewPrice, currency: p.currency })),
    rates,
  )
  const minTransfer = minUsdOf(
    priceRows.map((p) => ({ value: p.transferPrice, currency: p.currency })),
    rates,
  )

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
      <nav aria-label="breadcrumb" className="text-xs text-muted-foreground">
        <Link href="/" className="hover:text-primary">
          <T k="nav.home" />
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href="/tlds" className="hover:text-primary">
          <T k="nav.tlds" />
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">.{row.tld}</span>
      </nav>

      <header className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">
          <TldType type={row.type} />
        </p>
        <h1 className="font-mono text-4xl font-bold tracking-tight md:text-5xl">.{row.tld}</h1>
        <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">{row.description}</p>
        <p className="text-xs text-muted-foreground">
          <DataUpdated date={lastUpdated} />
        </p>
      </header>

      <section aria-label="lowest prices" className="grid grid-cols-3 gap-px border border-border bg-border">
        {(
          [
            { label: "tld.minRegister", value: minRegister, note: "tld.noteFirst" },
            { label: "tld.minRenew", value: minRenew, note: "tld.noteYear" },
            { label: "tld.minTransfer", value: minTransfer, note: "tld.noteTransfer" },
          ] as const
        ).map((item) => (
          <div key={item.label} className="flex flex-col gap-1 bg-card p-3 md:gap-2 md:p-6">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground md:text-xs md:tracking-widest">
              <T k={item.label} />
            </span>
            <span className="font-mono text-lg font-bold tabular-nums text-primary md:text-3xl">
              {item.value != null ? <Money value={item.value} from="USD" /> : "—"}
            </span>
            <span className="text-[10px] text-muted-foreground md:text-xs">
              <T k={item.note} />
            </span>
          </div>
        ))}
      </section>

      <section aria-labelledby="price-list" className="flex flex-col gap-4">
        <h2 id="price-list" className="text-xl font-bold tracking-tight">
          <T k="tld.allRegistrarPrices" /> ({priceRows.length})
        </h2>
        <PriceTable rows={priceRows} />
        <p className="text-xs leading-relaxed text-muted-foreground">
          <T k="tld.tip" />
        </p>
      </section>
    </div>
  )
}
