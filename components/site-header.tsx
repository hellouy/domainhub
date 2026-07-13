import Link from "next/link"

const NAV_ITEMS = [
  { href: "/tlds", label: "全部后缀" },
  { href: "/registrars", label: "注册商" },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span aria-hidden="true" className="flex size-6 items-center justify-center rounded bg-primary font-mono text-sm font-bold text-primary-foreground">
            t.
          </span>
          <span className="font-mono text-sm font-semibold tracking-tight">tldbi.com</span>
        </Link>
        <nav aria-label="主导航" className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
