import Link from "next/link"
import { Home, Search } from "lucide-react"
import { getSiteSettings } from "@/lib/site-settings"
import { BackButton } from "@/components/back-button"

export default async function NotFound() {
  const s = await getSiteSettings()

  return (
    <div className="min-h-svh flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-lg mx-auto">
          {/* 404 大字 */}
          <div className="relative mb-6">
            <span className="text-[10rem] leading-none font-bold tracking-tighter text-muted/10 select-none">
              404
            </span>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Search className="w-10 h-10 text-primary" />
              </div>
            </div>
          </div>

          {/* 标题与描述 */}
          <h1 className="text-2xl font-bold tracking-tight mb-3">
            {s.titleEn ? "Page Not Found" : "页面不存在"}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-8">
            {s.titleEn
              ? "The page you're looking for doesn't exist or has been moved."
              : "您访问的页面不存在或已被移除，请检查网址是否正确。"}
          </p>

          {/* 操作按钮 */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Home className="size-4" aria-hidden />
              {s.titleEn ? "Back to Home" : "返回首页"}
            </Link>
            <BackButton label={s.titleEn ? "Go Back" : "上一页"} />
          </div>

          {/* 建议链接 */}
          <div className="mt-12 pt-8 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-3">
              {s.titleEn ? "You might find these helpful:" : "您可能需要："}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              <Link href="/" className="text-primary hover:underline">
                {s.titleEn ? "Home" : "首页"}
              </Link>
              <span className="text-muted-foreground/50">·</span>
              <Link href="/prices" className="text-primary hover:underline">
                {s.titleEn ? "Price Comparison" : "价格对比"}
              </Link>
              <span className="text-muted-foreground/50">·</span>
              <Link href="/admin" className="text-primary hover:underline">
                {s.titleEn ? "Dashboard" : "后台管理"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
