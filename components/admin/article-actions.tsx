"use client"

import { useTransition } from "react"
import { toggleArticlePublished, deleteArticle } from "@/app/actions/articles"

export function ArticlePublishToggle({ id, isPublished }: { id: number; isPublished: boolean }) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => toggleArticlePublished(id, !isPublished))}
      className={
        isPublished
          ? "rounded-md border border-green-300 bg-green-50 px-3 py-1.5 text-xs text-green-700 hover:bg-green-100 disabled:opacity-50"
          : "rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
      }
    >
      {isPublished ? "已发布" : "草稿"}
    </button>
  )
}

export function DeleteArticleButton({ id }: { id: number }) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm(`确认删除文章 #${id}？此操作不可撤销。`)) {
          startTransition(() => deleteArticle(id))
        }
      }}
      className="rounded-md border border-border px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
    >
      删除
    </button>
  )
}
