import Link from "next/link"
import { CurrencyToggle, LocaleToggle, ThemeToggle } from "@/components/header-toggles"
import { getSiteSettings } from "@/lib/site-settings"

export async function SiteHeader() {
  const s = await getSiteSettings()
  const brandName = `${s.brandTextMain}${s.brandTextAccent}${s.brandSuffix}`

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" aria-label={`${brandName} 首页`} className="flex items-center gap-2">
          {s.logoUrl ? (
            // 后台上传/填写了 Logo 图片:显示图片替代文字标(任意图片源用原生 img)
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logoUrl} alt={brandName} className="h-7 w-auto object-contain" />
          ) : (
            <>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-sky-300 shadow-sm shadow-primary/20">
                <span className="font-mono text-sm font-black tracking-tight text-primary-foreground">D</span>
              </span>

              <span className="flex items-baseline font-mono text-lg font-bold tracking-[-0.08em] text-foreground">
                {s.brandTextMain}
                <span className="text-primary">{s.brandTextAccent}</span>
              </span>

              {s.brandSuffix && (
                <span className="ml-0.5 self-center rounded-md bg-primary px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-tight text-primary-foreground">
                  {s.brandSuffix}
                </span>
              )}
            </>
          )}
        </Link>
        <div className="flex items-center gap-0.5">
          <CurrencyToggle />
          <LocaleToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
