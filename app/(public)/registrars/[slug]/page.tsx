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
          {priceRows.map((p) => (
            <article key={p.priceId} className="flex flex-col gap-3 p-3">
              <div className="flex items-center justify-between gap-3">
                <Link href={`/tld/${p.tld}`} className="font-mono font-semibold hover:text-primary">
                  .{p.tld}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                  <T k="th.updated" /> <RelativeTime date={p.updatedAt} />
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground"><T k="th.register" /></dt>
                  <dd className="mt-1 truncate font-mono text-sm tabular-nums">
                    <PromotionPrice
                      price={p.registerPrice}
                      promotionPrice={p.promotionPrice}
                      promoCode={p.promoCode}
                      promoCodes={p.promoCodes}
                      promotionEndsAt={p.promotionEndsAt}
                      currency={p.currency}
                    />
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground"><T k="th.renew" /></dt>
                  <dd className="mt-1 truncate font-mono text-sm tabular-nums"><Money value={p.renewPrice} from={p.currency} /></dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground"><T k="th.transfer" /></dt>
                  <dd className="mt-1 truncate font-mono text-sm tabular-nums"><Money value={p.transferPrice} from={p.currency} /></dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground"><T k="th.promo" /></dt>
                  <dd className="mt-1 truncate font-mono text-sm tabular-nums">
                    {p.promotionPrice != null ? (
                      <span className="font-semibold text-primary"><Money value={p.promotionPrice} from={p.currency} /></span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
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
