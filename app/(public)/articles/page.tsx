import type { Metadata } from "next"
import Link from "next/link"
import { Newspaper } from "lucide-react"
import { listPublishedArticles } from "@/lib/articles"
import { getActiveAdsByPosition } from "@/lib/ads"
import { AdSlot } from "@/components/ad-slot"
import { formatDate } from "@/lib/format"

export const revalidate = 300

export const metadata: Metadata = {
  title: "域名行业文章 — 选购指南、价格趋势与注册商评测",
  description:
    "tldbi.com 原创域名行业文章：域名后缀投资价值、注册商选择、注册与续费价格趋势、建站成本与品牌域名策略。",
  alternates: { canonical: "/articles" },
  openGraph: {
    title: "域名行业文章",
    description: "域名后缀投资、注册商选择与价格趋势的原创文章。",
  },
}

export default async function ArticlesPage() {
  const [articles, sidebarAds] = await Promise.all([
    listPublishedArticles(100),
    getActiveAdsByPosition("tld-list-sidebar"),
  ])

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "域名行业文章",
    description: "域名后缀投资、注册商选择与价格趋势的原创文章。",
    url: "https://tldbi.com/articles",
    isPartOf: { "@id": "https://tldbi.com/#website" },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: articles.length,
      itemListElement: articles.map((a, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `https://tldbi.com/articles/${a.slug}`,
        name: a.title,
      })),
    },
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 md:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">Articles</p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">域名行业文章</h1>
        <p className="max-w-2xl leading-relaxed text-muted-foreground">
          关于域名后缀价值、注册商选择、价格趋势与建站成本的原创分析，帮助你在注册域名前做出更明智的决策。
        </p>
      </header>

      <div className="flex flex-col gap-8 md:flex-row">
        <div className="flex-1">
          <AdSlot ads={sidebarAds} />

          {articles.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-border p-12 text-center">
              <Newspaper className="mx-auto size-8 text-muted-foreground/60" aria-hidden />
              <p className="mt-3 text-sm text-muted-foreground">文章正在准备中，敬请期待。</p>
            </div>
          ) : (
            <ul className="mt-6 flex flex-col gap-4">
              {articles.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/articles/${a.slug}`}
                    className="group flex flex-col gap-2 rounded-lg border border-border p-5 transition-colors hover:border-primary/40 hover:bg-accent/40"
                  >
                    <h2 className="text-lg font-semibold text-foreground group-hover:text-primary">
                      {a.title}
                    </h2>
                    <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {a.excerpt}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {a.publishedAt && <time dateTime={a.publishedAt}>{formatDate(a.publishedAt)}</time>}
                      {a.topic && <span className="truncate">· {a.topic}</span>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
