import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { getSiteSettings } from "@/lib/site-settings"

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const s = await getSiteSettings()

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter
        brandTextMain={s.brandTextMain}
        brandTextAccent={s.brandTextAccent}
        brandSuffix={s.brandSuffix}
        logoUrl={s.logoUrl}
        disclaimerZh={s.footerDisclaimerZh}
        disclaimerEn={s.footerDisclaimerEn}
      />
    </div>
  )
}
