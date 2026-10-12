import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { PriceTable } from "@/components/price-table"
import { Money } from "@/components/money"
import { getActivePromotionPrice } from "@/lib/promotion"
import { T, TldType, DataUpdated } from "@/components/i18n-text"
import { getPricesForTld, getTldByName, getTldLastUpdated, getTldsWithMinPrice } from "@/lib/db/queries"
import { getUsdRates, type UsdRates } from "@/lib/fx"
import { usablePriceUsd } from "@/lib/pricing"

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

export async function generateStaticParams() {
  const popular = await getTldsWithMinPrice(true)
  return popular.slice(0, 60).map((t) => ({ tld: t.tld }))
}

/** 跨币种最低价:与首页、/tlds 共用 lib/pricing 的同一规则。 */
function minUsdOf(
  values: { value: string | null; currency: string; isPromotion?: boolean; rawRegister?: string | null }[],
  rates: UsdRates,
) {
  const nums = values
    .map((v) => usablePriceUsd(v.value, v.currency, rates, { isPromotion: v.isPromotion, rawRegister: v.rawRegister }))
    .filter((v): v is number => v != null)
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
    priceRows.map((p) => {
      const promotionPrice = getActivePromotionPrice(p.registerPrice, p.promotionPrice, p.promotionEndsAt)
      return {
        value: promotionPrice ?? p.registerPrice,
        currency: p.currency,
        isPromotion: promotionPrice !== null,
        rawRegister: p.registerPrice,
      }
    }),
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:gap-10 md:px-6 md:py-12">
      <script
        type="application/ld+json"
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

      <header className="flex flex-col gap-2 md:gap-3">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">
          <TldType type={row.type} />
        </p>
        <h1 className="font-mono text-4xl font-bold tracking-tight md:text-5xl">.{row.tld}</h1>
        <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">{row.description}</p>
        <p className="text-xs text-muted-foreground">
          <DataUpdated date={lastUpdated} />
        </p>
      </header>

      <dl aria-label="lowest prices" className="flex items-end gap-6 border-b border-border pb-6 md:gap-12">
        {(
          [
            { label: "tld.minRegister", value: minRegister, primary: true },
            { label: "tld.minRenew", value: minRenew, primary: false },
            { label: "tld.minTransfer", value: minTransfer, primary: false },
          ] as const
        ).map((item) => (
          <div key={item.label} className="flex min-w-0 flex-col gap-1">
            <dt className="text-xs text-muted-foreground">
              <T k={item.label} />
            </dt>
            <dd
              className={
                item.primary
                  ? "font-mono text-2xl font-bold tabular-nums text-primary md:text-4xl"
                  : "font-mono text-base font-semibold tabular-nums text-foreground md:text-2xl"
              }
            >
              {item.value != null ? <Money value={item.value} from="USD" /> : "—"}
            </dd>
          </div>
        ))}
      </dl>

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
