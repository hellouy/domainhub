import Link from "next/link"
import { Home, Search } from "lucide-react"
import { BackButton } from "@/components/back-button"

export default function NotFound() {
  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-4 bg-background">
      <div className="text-center max-w-lg mx-auto">
        {/* 404 大字 */}
        <div className="relative mb-8">
          <span className="text-[8rem] leading-none font-bold tracking-tighter text-muted/10 select-none">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Search className="w-8 h-8 text-primary" />
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold tracking-tight mb-3">页面不存在</h1>
        <p className="text-muted-foreground text-sm leading-relaxed mb-8">
          您访问的页面不存在或已被移除，请检查网址是否正确。
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Home className="size-4" aria-hidden />
            返回首页
          </Link>
          <BackButton label="上一页" />
        </div>
      </div>
    </div>
  )
}
