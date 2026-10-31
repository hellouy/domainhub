"use server"

import { db } from "@/lib/db"
import { articles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { invalidateArticles, slugExists, slugify } from "@/lib/articles"
import { generateArticle } from "@/lib/ai-article"

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) throw new Error("未授权")
}

/** 唯一化 slug:冲突时追加递增后缀 */
async function uniqueSlug(base: string, excludeId?: number): Promise<string> {
  let candidate = base
  let n = 1
  while (await slugExists(candidate, excludeId)) {
    n += 1
    candidate = `${base}-${n}`
  }
  return candidate
}

/**
 * 用 AI 生成一篇文章并直接入库(默认未发布)。
 * 返回生成结果供后台展示,失败时返回具体原因。
 */
export async function generateArticleAction(
  _prevState: { ok?: boolean; error?: string; articleId?: number; model?: string; title?: string } | null,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string; articleId?: number; model?: string; title?: string }> {
  await requireAdmin()
  const topic = String(formData.get("topic") ?? "").trim()
  const locale = String(formData.get("locale") ?? "zh") === "en" ? "en" : "zh"
  const keywords = String(formData.get("keywords") ?? "").trim()
  const publishNow = formData.get("publishNow") === "true"

  if (topic.length < 4) return { error: "请填写至少 4 个字的文章主题" }

  if (!process.env.AI_GATEWAY_API_KEY && !process.env.GOOGLE_AI_API_KEY && !process.env.ZHIPU_API_KEY && !process.env.GROQ_DIRECT_API_KEY && !process.env.GITHUB_MODELS_TOKEN) {
    return { error: "未配置任何 AI 渠道,请在环境变量中设置 AI_GATEWAY_API_KEY 等" }
  }

  try {
    const { draft, modelUsed } = await generateArticle({ topic, locale, keywords })
    const slug = await uniqueSlug(slugify(draft.slug || draft.title))
    const now = new Date()

    const [row] = await db
      .insert(articles)
      .values({
        slug,
        title: draft.title,
        excerpt: draft.excerpt,
        content: draft.content,
        topic,
        locale,
        keywords: draft.keywords || keywords,
        model: modelUsed,
        isPublished: publishNow,
        publishedAt: publishNow ? now : null,
      })
      .returning({ id: articles.id })

    invalidateArticles()
    revalidatePath("/admin/articles")
    return { ok: true, articleId: row?.id, model: modelUsed, title: draft.title }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[v0] AI 生成文章失败:", message)
    return { error: `生成失败: ${message.slice(0, 200)}` }
  }
}

/** 保存编辑(标题/摘要/正文/关键词/发布时间) */
export async function updateArticle(
  _prevState: { ok?: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  await requireAdmin()
  const str = (k: string) => String(formData.get(k) ?? "").trim()
  const id = Number(formData.get("id"))
  if (!id) return { error: "缺少文章 ID" }

  const title = str("title")
  if (!title) return { error: "标题不能为空" }

  try {
    const existing = await db.select({ publishedAt: articles.publishedAt, isPublished: articles.isPublished }).from(articles).where(eq(articles.id, id)).limit(1)
    const prev = existing[0]
    const nextPublished = formData.get("isPublished") === "true"
    const publishedAt = nextPublished ? prev?.publishedAt ?? new Date() : null

    await db
      .update(articles)
      .set({
        title,
        excerpt: str("excerpt"),
        content: String(formData.get("content") ?? ""),
        keywords: str("keywords"),
        weight: Number(formData.get("weight") ?? 1) || 1,
        isPublished: nextPublished,
        publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, id))

    invalidateArticles()
    revalidatePath("/admin/articles")
    return { ok: true }
  } catch (error) {
    console.error("[v0] 更新文章失败:", error)
    return { error: "更新失败，请重试" }
  }
}

/** 切换发布状态 */
export async function toggleArticlePublished(id: number, isPublished: boolean) {
  await requireAdmin()
  try {
    const [row] = await db.select({ publishedAt: articles.publishedAt }).from(articles).where(eq(articles.id, id)).limit(1)
    await db
      .update(articles)
      .set({
        isPublished,
        publishedAt: isPublished ? row?.publishedAt ?? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, id))
    invalidateArticles()
    revalidatePath("/admin/articles")
  } catch (error) {
    console.error("[v0] 切换文章发布状态失败:", error)
  }
}

/** 删除文章 */
export async function deleteArticle(id: number) {
  await requireAdmin()
  try {
    await db.delete(articles).where(eq(articles.id, id))
    invalidateArticles()
    revalidatePath("/admin/articles")
  } catch (error) {
    console.error("[v0] 删除文章失败:", error)
  }
}
