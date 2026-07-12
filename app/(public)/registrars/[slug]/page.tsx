import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatPrice, formatRelative } from "@/lib/format"
import { getPricesForRegistrar, getRegistrarBySlug } from "@/lib/db/queries"

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
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="面包屑" className="text-xs text-muted-foreground">
        <Link href="/" className="hover:text-primary">
          首页
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href="/registrars" className="hover:text-primary">
          注册商
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">{row.name}</span>
      </nav>

      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{row.name}</h1>
        <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">{row.description}</p>
        <div className="flex flex-wrap items-center gap-2">
          {row.icannAccredited && <Badge variant="secondary">ICANN 认证</Badge>}
          {row.whoisPrivacy && <Badge variant="secondary">免费 WHOIS 隐私</Badge>}
          {row.dnssec && <Badge variant="secondary">DNSSEC</Badge>}
          {row.paymentMethods.map((m) => (
            <Badge key={m} variant="outline">
              {m}
            </Badge>
          ))}
        </div>
        <a
          href={row.website}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1.5 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          访问官网
          <ExternalLink aria-hidden="true" className="size-4" />
        </a>
      </header>

      <section aria-labelledby="registrar-prices" className="flex flex-col gap-4">
        <h2 id="registrar-prices" className="text-xl font-bold tracking-tight">
          全部后缀价格（{priceRows.length}）
        </h2>
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary text-left">
                <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  后缀
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  注册
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  续费
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  转入
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  更新时间
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
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums">{formatPrice(p.registerPrice, p.currency)}</td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums">{formatPrice(p.renewPrice, p.currency)}</td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums">{formatPrice(p.transferPrice, p.currency)}</td>
                  <td className="px-4 py-3.5 text-right text-xs text-muted-foreground">{formatRelative(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
