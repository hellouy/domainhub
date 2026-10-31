"use client"

import { useActionState, useState, useEffect, useTransition } from "react"
import { Sparkles, X, CheckCircle2 } from "lucide-react"
import { generateArticleAction } from "@/app/actions/articles"

/**
 * AI 生成文章弹窗。
 * 提交主题后由服务端沿多模型回退链生成原创文章并入库(默认草稿),
 * 成功后提示并允许继续生成下一篇。
 */
export function GenerateArticleDialog() {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(generateArticleAction, null)
  const [, startTransition] = useTransition()

  // 每次重新打开时重置表单错误展示
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (open) setNonce((n) => n + 1)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Sparkles className="size-4" aria-hidden />
        AI 生成文章
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4">
          <div className="mt-8 w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">AI 生成原创推广文章</h2>
              <button
                type="button"
                onClick={() => startTransition(() => setOpen(false))}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <form key={nonce} action={formAction} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  文章主题 <span className="text-destructive">*</span>
                </span>
                <textarea
                  name="topic"
                  required
                  rows={3}
                  minLength={4}
                  placeholder="例如：2026 年 .ai 域名还值得注册吗？品牌域名的长期价值"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-base"
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">语言</span>
                  <select
                    name="locale"
                    defaultValue="zh"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="zh">中文</option>
                    <option value="en">English</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">关键词(可选)</span>
                  <input
                    type="text"
                    name="keywords"
                    placeholder="域名注册, .ai 域名, 比价"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-base"
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="publishNow" value="true" />
                生成后立即发布(不勾选则保存为草稿)
              </label>

              <p className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
                生成通常需要 20-90 秒,请勿关闭弹窗。生成的内容为原创草稿,建议发布前人工校对。
              </p>

              {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

              {state?.ok && (
                <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <div>
                    <p className="font-medium">已生成并保存（ID #{state.articleId}）</p>
                    <p className="mt-0.5 text-xs">标题：{state.title}</p>
                    <p className="text-xs">模型：{state.model}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => startTransition(() => setOpen(false))}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
                >
                  关闭
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Sparkles className="size-4" aria-hidden />
                  {pending ? "生成中…" : "开始生成"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
