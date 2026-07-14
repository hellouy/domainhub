import { getSiteSettings } from "@/lib/site-settings"
import { SiteSettingsForm } from "@/components/admin/site-settings-form"

export const metadata = { title: "站点设置" }

export default async function AdminSettingsPage() {
  const settings = await getSiteSettings()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">站点设置</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          编辑品牌 Logo、标题、描述与页脚，保存后前台立即生效。
        </p>
      </div>
      <SiteSettingsForm settings={settings} />
    </div>
  )
}
