"use client"

import { useActionState, useState, useEffect, useTransition } from "react"
import { Plus, Pencil, X } from "lucide-react"
import { createAd, updateAd } from "@/app/actions/admin"
import { AD_POSITIONS } from "@/lib/ad-positions"
import type { AdSlotRow } from "@/lib/db/schema"

type Props =
  | { mode: "create" }
  | { mode: "edit"; ad: AdSlotRow }

export function AdFormDialog(props: Props) {
  const [open, setOpen] = useState(false)
  const action = props.mode === "create" ? createAd : updateAd
  const [state, formAction, pending] = useActionState(action, null)
  const [, startTransition] = useTransition()

  const ad = props.mode === "edit" ? props.ad : null

  useEffect(() => {
    if (state?.ok) {
      startTransition(() => {
        setOpen(false)
      })
    }
  }, [state])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          props.mode === "create"
            ? "inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            : "inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        }
      >
        {props.mode === "create" ? (
          <>
            <Plus className="size-4" aria-hidden />
            新建广告
          </>
        ) : (
          <>
            <Pencil className="size-3.5" aria-hidden />
            编辑
          </>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4">
          <div className="mt-8 w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {props.mode === "create" ? "新建广告" : `编辑广告 #${ad?.id}`}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <form action={formAction} className="flex flex-col gap-4">
              {ad && <input type="hidden" name="id" value={ad.id} />}

              <div className="grid grid-cols-2 gap-4">
                <Field label="投放位置" required>
                  <select
                    name="position"
                    defaultValue={ad?.position ?? ""}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="" disabled>选择位置</option>
                    {AD_POSITIONS.map((p) => (
                      <option key={p.position} value={p.position}>
                        {p.label} ({p.position})
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="广告类型">
                  <select
                    name="type"
                    defaultValue={ad?.type ?? "text"}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="text">文字广告</option>
                    <option value="image">图片广告</option>
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="标题(中文)">
                  <input
                    type="text"
                    name="titleZh"
                    defaultValue={ad?.titleZh ?? ""}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="标题(英文)">
                  <input
                    type="text"
                    name="titleEn"
                    defaultValue={ad?.titleEn ?? ""}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="副文案(中文)">
                  <input
                    type="text"
                    name="subtitleZh"
                    defaultValue={ad?.subtitleZh ?? ""}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="副文案(英文)">
                  <input
                    type="text"
                    name="subtitleEn"
                    defaultValue={ad?.subtitleEn ?? ""}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="图片 URL (image 类型必填)">
                  <input
                    type="url"
                    name="imageUrl"
                    defaultValue={ad?.imageUrl ?? ""}
                    placeholder="https://..."
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="图片 alt 文本">
                  <input
                    type="text"
                    name="imageAlt"
                    defaultValue={ad?.imageAlt ?? ""}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              <Field label="跳转链接">
                <input
                  type="url"
                  name="linkUrl"
                  defaultValue={ad?.linkUrl ?? ""}
                  placeholder="https://..."
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>

              <div className="grid grid-cols-3 gap-4">
                <Field label="权重">
                  <input
                    type="number"
                    name="weight"
                    defaultValue={ad?.weight ?? 1}
                    min={0}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="上线时间 (空=立即)">
                  <input
                    type="datetime-local"
                    name="startsAt"
                    defaultValue={ad?.startsAt ? toLocalInput(ad.startsAt) : ""}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="下线时间 (空=长期)">
                  <input
                    type="datetime-local"
                    name="endsAt"
                    defaultValue={ad?.endsAt ? toLocalInput(ad.endsAt) : ""}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="openInNewTab"
                    value="true"
                    defaultChecked={ad?.openInNewTab ?? true}
                  />
                  新窗口打开
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="isActive"
                    value="true"
                    defaultChecked={ad?.isActive ?? true}
                  />
                  启用
                </label>
              </div>

              {state?.error && (
                <p className="text-sm text-destructive">{state.error}</p>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {pending ? "保存中..." : "保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
    </label>
  )
}

function toLocalInput(date: Date | string): string {
  const d = new Date(date)
  const offset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - offset).toISOString().slice(0, 16)
}
