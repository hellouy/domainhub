import { getAllAds } from "@/lib/ads"
import { AD_POSITIONS, positionLabel } from "@/lib/ad-positions"
import { Megaphone, CheckCircle2, XCircle, Plus } from "lucide-react"
import { PageHeader, StatCard } from "@/components/admin/ui"
import { AdFormDialog } from "@/components/admin/ad-form-dialog"
import { AdToggle } from "@/components/admin/ad-toggle"
import { DeleteAdButton } from "@/components/admin/delete-ad-button"
import { formatDateTime } from "@/lib/format"

export const metadata = { title: "广告位管理" }

export default async function AdminAdsPage() {
  const ads = await getAllAds()

  const activeCount = ads.filter((a) => a.isActive).length
  const positionsUsed = new Set(ads.map((a) => a.position)).size

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="广告位管理"
        description="管理全站广告位：文字 / 图片广告，中英双语，按位置投放，定时上下线。"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Megaphone} label="广告总数" value={ads.length} />
        <StatCard icon={CheckCircle2} label="启用中" value={activeCount} tone="positive" />
        <StatCard icon={XCircle} label="已停用" value={ads.length - activeCount} />
        <StatCard icon={Plus} label="投放位置数" value={positionsUsed} />
      </div>

      <div className="flex items-center justify-end">
        <AdFormDialog mode="create" />
      </div>

      {ads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Megaphone className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            暂无广告，点击右上方「新建广告」添加第一条。
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">位置</th>
                <th className="px-4 py-3">类型</th>
                <th className="px-4 py-3">标题(中)</th>
                <th className="px-4 py-3">标题(英)</th>
                <th className="px-4 py-3">链接</th>
                <th className="px-4 py-3">权重</th>
                <th className="px-4 py-3">时间范围</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ads.map((ad) => (
                <tr key={ad.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{ad.id}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">
                      {positionLabel(ad.position)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={ad.type === "image" ? "text-primary" : "text-foreground"}>
                      {ad.type === "image" ? "图片" : "文字"}
                    </span>
                  </td>
                  <td className="max-w-32 truncate px-4 py-3">{ad.titleZh || "—"}</td>
                  <td className="max-w-32 truncate px-4 py-3">{ad.titleEn || "—"}</td>
                  <td className="max-w-32 truncate px-4 py-3 text-xs text-muted-foreground">
                    {ad.linkUrl || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{ad.weight}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {ad.startsAt ? formatDateTime(ad.startsAt) : "立即"}
                    {" → "}
                    {ad.endsAt ? formatDateTime(ad.endsAt) : "长期"}
                  </td>
                  <td className="px-4 py-3">
                    <AdToggle id={ad.id} isActive={ad.isActive} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <AdFormDialog mode="edit" ad={ad} />
                      <DeleteAdButton id={ad.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h3 className="text-sm font-semibold">可用位置</h3>
        <ul className="mt-2 flex flex-wrap gap-2">
          {AD_POSITIONS.map((p) => (
            <li key={p.position} className="rounded border border-border bg-card px-2 py-1 text-xs">
              <code className="text-primary">{p.position}</code>
              <span className="ml-1 text-muted-foreground">{p.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
