"use client"

import { useActionState, useState, useEffect, useTransition } from "react"
import { Pencil, X } from "lucide-react"
import { updateArticle } from "@/app/actions/articles"
import type { ArticleRow } from "@/lib/db/schema"

export function ArticleEditDialog({ article }: { article: ArticleRow }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(updateArticle, null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (state?.ok) {
      startTransition(() => setOpen(false))
    }
  }, [state])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <Pencil className="size-3.5" aria-hidden />
        编辑
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4">
          <div className="mt-8 w-full max-w-4xl rounded-lg border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">编辑文章 #{article.id}</h2>
              <button
                type="button"
                onClick={() => startTransition(() => setOpen(false))}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <form action={formAction} className="flex flex-col gap-4">
              <input type="hidden" name="id" value={article.id} />

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    标题 <span className="text-destructive">*</span>
                  </span>
                  <input
                    type="text"
                    name="title"
                    required
                    defaultValue={article.title}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-base"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">关键词(逗号分隔)</span>
                  <input
                    type="text"
                    name="keywords"
                    defaultValue={article.keywords}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-base"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">摘要 / 导语</span>
                <textarea
                  name="excerpt"
                  rows={2}
                  defaultValue={article.excerpt}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-base"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">正文(Markdown)</span>
                <textarea
                  name="content"
                  rows={22}
                  defaultValue={article.content}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm leading-relaxed"
                />
              </label>

              <div className="grid grid-cols-3 gap-4">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">权重(越大越靠前)</span>
                  <input
                    type="number"
                    name="weight"
                    min={0}
                    defaultValue={article.weight}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-base"
                  />
                </label>
                <label className="col-span-2 flex items-end gap-2 pb-2 text-sm">
                  <input type="checkbox" name="isPublished" value="true" defaultChecked={article.isPublished} />
                  已发布(勾选后前台可见并进入 sitemap)
                </label>
              </div>

              {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

              <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => startTransition(() => setOpen(false))}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {pending ? "保存中…" : "保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
