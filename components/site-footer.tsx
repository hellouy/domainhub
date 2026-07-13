import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-start md:justify-between md:px-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="flex size-5 items-center justify-center rounded bg-primary font-mono text-xs font-bold text-primary-foreground">
              t.
            </span>
            <span className="font-mono text-sm font-semibold">tldbi.com</span>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            聚合全球主流域名注册商的注册、续费与转入价格，帮助你在注册前找到最划算的选择。
          </p>
        </div>
        <nav aria-label="页脚导航" className="flex gap-10">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">浏览</span>
            <Link href="/tlds" className="text-sm text-foreground hover:text-primary">
              全部后缀
            </Link>
            <Link href="/registrars" className="text-sm text-foreground hover:text-primary">
              注册商
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">热门比价</span>
            <Link href="/compare/com" className="text-sm text-foreground hover:text-primary">
              .com 比价
            </Link>
            <Link href="/compare/io" className="text-sm text-foreground hover:text-primary">
              .io 比价
            </Link>
            <Link href="/compare/ai" className="text-sm text-foreground hover:text-primary">
              .ai 比价
            </Link>
          </div>
        </nav>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <p className="text-xs text-muted-foreground">价格数据仅供参考，请以注册商官网为准。</p>
          <p className="font-mono text-xs text-muted-foreground">tldbi.com</p>
        </div>
      </div>
    </footer>
  )
}
