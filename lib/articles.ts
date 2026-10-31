import "server-only"

import { unstable_cache, revalidateTag, revalidatePath } from "next/cache"
import { and, desc, eq, isNotNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { articles, type ArticleRow } from "@/lib/db/schema"

export const ARTICLES_TAG = "articles-v1"

/** 前台列表用的精简文章 */
export type ArticleSummary = {
  id: number
  slug: string
  title: string
  excerpt: string
  locale: string
  topic: string
  keywords: string
  publishedAt: string | null
}

function toSummary(row: ArticleRow): ArticleSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    locale: row.locale,
    topic: row.topic,
    keywords: row.keywords,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  }
}

/** 已发布文章列表(前台 / 文章页 / llms.txt 共用,带缓存) */
export const listPublishedArticles = unstable_cache(
  async (limit?: number): Promise<ArticleSummary[]> => {
    const rows = await db
      .select()
      .from(articles)
      .where(and(eq(articles.isPublished, true), isNotNull(articles.publishedAt)))
      .orderBy(desc(articles.weight), desc(articles.publishedAt))
      .limit(limit && limit > 0 ? limit : 200)
    return rows.map(toSummary)
  },
  ["published-articles"],
  { tags: [ARTICLES_TAG] },
)

/** 按 slug 取已发布文章(带缓存) */
export const getPublishedArticleBySlug = unstable_cache(
  async (slug: string): Promise<ArticleRow | null> => {
    const [row] = await db
      .select()
      .from(articles)
      .where(and(eq(articles.slug, slug), eq(articles.isPublished, true)))
      .limit(1)
    return row ?? null
  },
  ["article-by-slug"],
  { tags: [ARTICLES_TAG] },
)

/** 后台:全部文章(带缓存也会随标签失效刷新) */
export async function getAllArticles(): Promise<ArticleRow[]> {
  return db.select().from(articles).orderBy(desc(articles.createdAt))
}

/** 后台:按 id 取单条 */
export async function getArticleById(id: number): Promise<ArticleRow | undefined> {
  const [row] = await db.select().from(articles).where(eq(articles.id, id)).limit(1)
  return row
}

/** 同名 slug 是否已存在(可排除自身 id) */
export async function slugExists(slug: string, excludeId?: number): Promise<boolean> {
  const [row] = await db.select({ id: articles.id }).from(articles).where(eq(articles.slug, slug)).limit(1)
  if (!row) return false
  return excludeId ? row.id !== excludeId : true
}

/** 让文章相关缓存立即失效(后台新增/编辑/删除/发布后调用) */
export function invalidateArticles() {
  revalidateTag(ARTICLES_TAG, "max")
  revalidatePath("/articles")
}

/** 生成 URL 友好的 slug:保留字母数字,中文转为拼音无关的稳定哈希后缀 */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  if (!base) return `article-${Date.now().toString(36)}`
  // 纯 ASCII slug 直接使用
  if (/^[a-z0-9-]+$/.test(base)) return base.slice(0, 80)
  // 含中文时追加稳定短哈希,保证可读且唯一
  const hash = Array.from(input).reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(36).slice(0, 6)
  return `${base.slice(0, 50).replace(/[^a-z0-9-]/g, "")}-${hash}`.replace(/-+/g, "-").replace(/^-|-$/g, "")
}
