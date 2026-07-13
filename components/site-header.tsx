import Link from "next/link"
import { CurrencyToggle, LocaleToggle, ThemeToggle } from "@/components/header-toggles"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" aria-label="tldbi.com 首页" className="flex items-baseline">
          {/* 品牌字标:TLD 大写 + bi 小写(TLD 比价),紧随 .com 主色标签形成整体 */}
          <span className="font-mono text-lg font-bold tracking-tight text-foreground">
            TLD<span className="text-primary">bi</span>
          </span>
          <span className="ml-1 self-center rounded-md bg-primary px-1.5 py-0.5 font-mono text-xs font-bold tracking-tight text-primary-foreground">
            .com
          </span>
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
