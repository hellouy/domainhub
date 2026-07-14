"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Upload, Loader2, X, Check } from "lucide-react"
import { updateSiteSettings } from "@/app/actions/admin"
import type { SiteSettings } from "@/lib/site-settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const inputCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
const textareaCls =
  "flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 leading-relaxed"

/** 图片字段:URL 输入 + 上传到 Blob + 预览 + 清除 */
function ImageField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: string
  onChange: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "上传失败")
      onChange(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="flex items-center gap-3">
        {value ? (
          <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
            {/* 用户提供的任意图片源,使用原生 img 以避免域名白名单限制 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="预览" className="size-full object-contain" />
          </span>
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-[10px] text-muted-foreground">
            无
          </span>
        )}
        <div className="flex flex-1 flex-col gap-2">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="粘贴图片 URL，或点击上传"
            className={inputCls}
          />
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              上传
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
                <X className="size-3.5" />
                清除
              </Button>
            )}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  )
}

export function SiteSettingsForm({ settings }: { settings: SiteSettings }) {
  const [state, formAction, pending] = useActionState(updateSiteSettings, null)
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl)
  const [faviconUrl, setFaviconUrl] = useState(settings.faviconUrl)
  const [brandMain, setBrandMain] = useState(settings.brandTextMain)
  const [brandAccent, setBrandAccent] = useState(settings.brandTextAccent)
  const [brandSuffix, setBrandSuffix] = useState(settings.brandSuffix)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (state?.ok) {
      setSaved(true)
      const id = setTimeout(() => setSaved(false), 2500)
      return () => clearTimeout(id)
    }
  }, [state])

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {/* 隐藏字段:同步上传/受控值到表单提交 */}
      <input type="hidden" name="logoUrl" value={logoUrl} />
      <input type="hidden" name="faviconUrl" value={faviconUrl} />

      {/* ---- 品牌 Logo ---- */}
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">品牌 Logo</h2>
          <p className="text-sm text-muted-foreground">文字标随时可改；若上传/填写 Logo 图片，则页头显示图片替代文字标。</p>
        </div>

        {/* 实时预览 */}
        <div className="flex items-center gap-3 rounded-md border border-dashed border-border bg-background px-4 py-3">
          <span className="text-xs text-muted-foreground">预览</span>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo 预览" className="h-7 w-auto object-contain" />
          ) : (
            <span className="flex items-baseline">
              <span className="font-mono text-lg font-bold tracking-tight text-foreground">
                {brandMain}
                <span className="text-primary">{brandAccent}</span>
              </span>
              {brandSuffix && (
                <span className="ml-1 self-center rounded-md bg-primary px-1.5 py-0.5 font-mono text-xs font-bold tracking-tight text-primary-foreground">
                  {brandSuffix}
                </span>
              )}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="brandTextMain">主体文字 *</Label>
            <Input id="brandTextMain" name="brandTextMain" value={brandMain} onChange={(e) => setBrandMain(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="brandTextAccent">强调色文字</Label>
            <Input id="brandTextAccent" name="brandTextAccent" value={brandAccent} onChange={(e) => setBrandAccent(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="brandSuffix">后缀标签</Label>
            <Input id="brandSuffix" name="brandSuffix" value={brandSuffix} onChange={(e) => setBrandSuffix(e.target.value)} />
          </div>
        </div>

        <ImageField
          label="Logo 图片（可选）"
          hint="填写则覆盖上方文字标。建议透明 PNG / SVG，高度约 40px。"
          value={logoUrl}
          onChange={setLogoUrl}
        />
        <ImageField
          label="浏览器图标 favicon（可选）"
          hint="标签页与收藏夹图标。建议 512×512 PNG 或 SVG；留空则用内置图标。"
          value={faviconUrl}
          onChange={setFaviconUrl}
        />
      </section>

      {/* ---- 标题与描述 ---- */}
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">标题与描述</h2>
          <p className="text-sm text-muted-foreground">用于浏览器标题、搜索引擎与分享卡片，按访客语言展示对应版本。</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="titleZh">站点标题（中文）</Label>
            <Input id="titleZh" name="titleZh" defaultValue={settings.titleZh} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="titleEn">站点标题（English）</Label>
            <Input id="titleEn" name="titleEn" defaultValue={settings.titleEn} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="descriptionZh">站点描述（中文）</Label>
            <textarea id="descriptionZh" name="descriptionZh" defaultValue={settings.descriptionZh} className={textareaCls} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="descriptionEn">站点描述（English）</Label>
            <textarea id="descriptionEn" name="descriptionEn" defaultValue={settings.descriptionEn} className={textareaCls} />
          </div>
        </div>
      </section>

      {/* ---- 页脚免责声明 ---- */}
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">页脚免责声明</h2>
          <p className="text-sm text-muted-foreground">显示在每个页面底部。</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="footerDisclaimerZh">免责声明（中文）</Label>
            <textarea id="footerDisclaimerZh" name="footerDisclaimerZh" defaultValue={settings.footerDisclaimerZh} className={textareaCls} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="footerDisclaimerEn">免责声明（English）</Label>
            <textarea id="footerDisclaimerEn" name="footerDisclaimerEn" defaultValue={settings.footerDisclaimerEn} className={textareaCls} />
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 flex items-center gap-3 border-t border-border bg-background/90 py-4 backdrop-blur">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          保存设置
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-primary">
            <Check className="size-4" />
            已保存，前台已即时生效
          </span>
        )}
        {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
      </div>
    </form>
  )
}
