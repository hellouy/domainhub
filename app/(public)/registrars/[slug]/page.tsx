import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Money } from "@/components/money"
import { PromotionPrice } from "@/components/promotion-price"
import { T, RelativeTime, RegistrarDescription } from "@/components/i18n-text"
import { RegistrarIcon } from "@/components/registrar-favicon"
import { getPricesForRegistrar, getRegistrarBySlug } from "@/lib/db/queries"
import { normalizeUrl, withRegistrarReferral } from "@/lib/utils"
import { getActivePromotionPrice, getTldSpecificCodes } from "@/lib/promotion"

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const row = await getRegistrarBySlug(slug)
  if (!row) return { title: "未找到该注册商" }
  return {
    title: `${row.name} 域名价格表 — 注册、续费、转入价格一览`,
    description: `${row.name} 的全部域名后缀价格：${row.description.slice(0, 80)}`,
    alternates: { canonical: `/registrars/${row.slug}` },
  }
}

export default async function RegistrarPage({ params }: Props) {
  const { slug } = await params
  const row = await getRegistrarBySlug(slug)
  if (!row || !row.isActive) notFound()

  const priceRows = await getPricesForRegistrar(row.id)
  const registrarUrl = withRegistrarReferral(normalizeUrl(row.website), "registrar_profile")

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: row.name,
    url: row.website,
    description: row.description,
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 md:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="breadcrumb" className="text-xs text-muted-foreground">
        <Link href="/" className="hover:text-primary">
          <T k="nav.home" />
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href="/registrars" className="hover:text-primary">
          <T k="nav.registrars" />
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">{row.name}</span>
      </nav>

      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <RegistrarIcon slug={row.slug} name={row.name} size="large" />
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{row.name}</h1>
        </div>
        <RegistrarDescription
          slug={row.slug}
          fallback={row.description}
          className="max-w-2xl text-pretty leading-relaxed text-muted-foreground"
        />
        <div className="flex flex-wrap items-center gap-2">
          {row.icannAccredited && (
            <Badge variant="secondary">
              <T k="badge.icann" />
            </Badge>
          )}
          {row.whoisPrivacy && (
            <Badge variant="secondary">
              <T k="badge.whois" />
            </Badge>
          )}
          {row.dnssec && (
            <Badge variant="secondary">
              <T k="badge.dnssec" />
            </Badge>
          )}
          {row.paymentMethods.map((m) => (
            <Badge key={m} variant="outline">
              {m}
            </Badge>
          ))}
        </div>
        {registrarUrl && (
          <a
            href={registrarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 w-fit items-center gap-1.5 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <T k="registrar.visit" />
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        )}
      </header>

      <section aria-labelledby="registrar-prices" className="flex flex-col gap-4">
        <h2 id="registrar-prices" className="text-xl font-bold tracking-tight">
          <T k="registrar.allPrices" /> ({priceRows.length})
        </h2>
        <div className="divide-y divide-border border border-border md:hidden">
          {priceRows.map((p) => {
            const activePromo = getActivePromotionPrice(p.registerPrice, p.promotionPrice, p.promotionEndsAt)
            const codes = getTldSpecificCodes(p.promoCodes, p.promoCode)
            return (
              <article key={p.priceId} className="flex flex-col gap-3 px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-col gap-1">
                    <Link
                      href={`/tld/${p.tld}`}
                      className="truncate font-mono text-lg font-semibold leading-tight hover:text-primary"
                    >
                      .{p.tld}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      <RelativeTime date={p.updatedAt} />
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5 font-mono tabular-nums">
                    <span className="text-[11px] font-sans text-muted-foreground">
                      <T k="th.register" />
                    </span>
                    {activePromo !== null ? (
                      <>
                        <span className="text-lg font-semibold leading-tight text-primary">
                          <Money value={activePromo} from={p.currency} />
                        </span>
                        <span className="text-xs text-muted-foreground line-through">
                          <Money value={p.registerPrice} from={p.currency} />
                        </span>
                      </>
                    ) : (
                      <span className="text-lg font-semibold leading-tight">
                        <Money value={p.registerPrice} from={p.currency} />
                      </span>
                    )}
                  </div>
                </div>

                <dl className="flex items-center gap-6 text-sm">
                  <div className="flex items-baseline gap-2">
                    <dt className="text-xs text-muted-foreground"><T k="th.renew" /></dt>
                    <dd className="font-mono tabular-nums"><Money value={p.renewPrice} from={p.currency} /></dd>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <dt className="text-xs text-muted-foreground"><T k="th.transfer" /></dt>
                    <dd className="font-mono tabular-nums"><Money value={p.transferPrice} from={p.currency} /></dd>
                  </div>
                </dl>

                {activePromo !== null && codes.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground"><T k="promo.code" /></span>
                    {codes.slice(0, 3).map((code) => (
                      <span
                        key={code}
                        className="border border-dashed border-primary/40 bg-primary/5 px-1.5 py-0.5 font-mono text-primary"
                      >
                        {code}
                      </span>
                    ))}
                    {codes.length > 3 && (
                      <span className="text-muted-foreground" title={codes.join(", ")}>
                        +{codes.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
        <div className="hidden overflow-x-auto border border-border md:block">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary text-left">
                <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  <T k="th.tld" />
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  <T k="th.register" />
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  <T k="th.renew" />
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  <T k="th.transfer" />
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  <T k="th.promo" />
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  <T k="th.updated" />
                </th>
              </tr>
            </thead>
            <tbody>
              {priceRows.map((p) => (
                <tr key={p.priceId} className="border-b border-border last:border-b-0 hover:bg-accent/50">
                  <td className="px-4 py-3.5">
                    <Link href={`/tld/${p.tld}`} className="font-mono font-semibold hover:text-primary">
                      .{p.tld}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums">
                    <PromotionPrice
                      price={p.registerPrice}
                      promotionPrice={p.promotionPrice}
                      promoCode={p.promoCode}
                      promoCodes={p.promoCodes}
                      promotionEndsAt={p.promotionEndsAt}
                      currency={p.currency}
                    />
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums">
                    <Money value={p.renewPrice} from={p.currency} />
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums">
                    <Money value={p.transferPrice} from={p.currency} />
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums">
                    {p.promotionPrice != null ? (
                      <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">
                        <Money value={p.promotionPrice} from={p.currency} />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right text-xs text-muted-foreground">
                    <RelativeTime date={p.updatedAt} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
