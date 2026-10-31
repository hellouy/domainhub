import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getPublishedArticleBySlug, listPublishedArticles } from "@/lib/articles"
import { renderMarkdown } from "@/lib/markdown"
import { formatDate } from "@/lib/format"
import { getActiveAdsByPosition } from "@/lib/ads"
import { AdSlot } from "@/components/ad-slot"

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

const SITE = "https://tldbi.com"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = await getPublishedArticleBySlug(slug)
  if (!article) return { title: "未找到该文章" }

  const url = `${SITE}/articles/${article.slug}`
  const published = article.publishedAt?.toISOString()

  return {
    title: article.title,
    description: article.excerpt,
    keywords: article.keywords ? article.keywords.split(",").map((k) => k.trim()).filter(Boolean) : undefined,
    alternates: { canonical: `/articles/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.excerpt,
      url,
      publishedTime: published,
      modifiedTime: article.updatedAt?.toISOString(),
      authors: [SITE],
      tags: article.keywords ? article.keywords.split(",").map((k) => k.trim()).filter(Boolean) : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.excerpt,
    },
  }
}

export default async function ArticleDetailPage({ params }: Props) {
  const { slug } = await params
  const [article, related] = await Promise.all([
    getPublishedArticleBySlug(slug),
    listPublishedArticles(6).catch(() => []),
  ])
  if (!article) notFound()

  const html = renderMarkdown(article.content)
  const url = `${SITE}/articles/${article.slug}`
  const published = article.publishedAt?.toISOString() ?? new Date().toISOString()

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt,
    datePublished: published,
    dateModified: article.updatedAt?.toISOString() ?? published,
    inLanguage: article.locale === "en" ? "en" : "zh-CN",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@type": "Organization", name: "tldbi.com", url: SITE },
    publisher: {
      "@type": "Organization",
      name: "tldbi.com",
      url: SITE,
      logo: { "@type": "ImageObject", url: `${SITE}/icon.svg` },
    },
    keywords: article.keywords,
    isPartOf: { "@id": `${SITE}/#website` },
  }

  const others = related.filter((a) => a.slug !== article.slug).slice(0, 4)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12 md:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="breadcrumb" className="text-xs text-muted-foreground">
        <Link href="/" className="hover:text-primary">
          首页
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href="/articles" className="hover:text-primary">
          文章
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="line-clamp-1 text-foreground">{article.title}</span>
      </nav>

      <header className="flex flex-col gap-3 border-b border-border pb-6">
        <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">{article.title}</h1>
        <p className="text-base leading-relaxed text-muted-foreground">{article.excerpt}</p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <time dateTime={published}>{formatDate(article.publishedAt)}</time>
          {article.topic && <span>· {article.topic}</span>}
        </div>
      </header>

      <AdSlot ads={await getActiveAdsByPosition("tld-detail-top")} />

      <article
        className="flex flex-col gap-3 text-[15px] text-foreground [&_a]:break-words"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {others.length > 0 && (
        <section className="mt-4 border-t border-border pt-8">
          <h2 className="mb-4 text-lg font-semibold">相关阅读</h2>
          <ul className="flex flex-col gap-3">
            {others.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/articles/${a.slug}`}
                  className="group flex flex-col gap-1 rounded-lg border border-border p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
                >
                  <span className="font-medium group-hover:text-primary">{a.title}</span>
                  <span className="line-clamp-1 text-sm text-muted-foreground">{a.excerpt}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-4 flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-5">
        <p className="text-sm font-medium">想找最便宜的域名注册商？</p>
        <p className="text-sm text-muted-foreground">
          在 tldbi.com 一键比较各注册商的注册、续费与转入价格。
        </p>
        <Link
          href="/tlds"
          className="mt-1 inline-flex w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          开始比价
        </Link>
      </div>
    </div>
  )
}
