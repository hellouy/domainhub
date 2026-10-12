import Link from "next/link"
import { CurrencyToggle, LocaleToggle, ThemeToggle } from "@/components/header-toggles"
import { SiteNavigation } from "@/components/site-navigation"
import { getSiteSettings } from "@/lib/site-settings"

export async function SiteHeader() {
  const s = await getSiteSettings()
  const brandName = `${s.brandTextMain}${s.brandTextAccent}${s.brandSuffix}`

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-12 w-full max-w-6xl items-center justify-between gap-3 px-4 md:h-14 md:px-6">
        <Link href="/" aria-label={`${brandName} 首页`} className="flex items-baseline">
          {s.logoUrl ? (
            // 后台上传/填写了 Logo 图片:显示图片替代文字标(任意图片源用原生 img)
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logoUrl} alt={brandName} className="h-7 w-auto object-contain" />
          ) : (
            <>
              {/* 品牌字标:主体 + 强调色 + 后缀主色标签,形成整体 */}
              <span className="font-mono text-lg font-bold tracking-tight text-foreground">
                {s.brandTextMain}
                <span className="text-primary">{s.brandTextAccent}</span>
              </span>
              {s.brandSuffix && (
                <span className="ml-1 self-center rounded-md bg-primary px-1.5 py-0.5 font-mono text-xs font-bold tracking-tight text-primary-foreground">
                  {s.brandSuffix}
                </span>
              )}
            </>
          )}
        </Link>
        <div className="flex items-center gap-0.5 md:gap-1">
          <SiteNavigation />
          <span aria-hidden="true" className="mx-2 hidden h-5 border-l border-border md:block" />
          <CurrencyToggle />
          <LocaleToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
