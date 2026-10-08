import type { Metadata } from "next"
import Link from "next/link"
import { Money } from "@/components/money"
import { T, TCount, TldType } from "@/components/i18n-text"
import { getTldsWithMinPrice } from "@/lib/db/queries"

export const revalidate = 300

export const metadata: Metadata = {
  title: "全部域名后缀",
  description: "浏览 tldbi.com 收录的 1800+ 域名后缀，查看每个后缀在各注册商的最低注册、续费与转入价格。",
  alternates: { canonical: "/tlds" },
}

export default async function TldsPage() {
  const rows = await getTldsWithMinPrice()

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-8 sm:gap-8 sm:py-12 md:px-6">
      <header className="flex flex-col gap-2 sm:gap-3">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">
          <T k="page.tlds.eyebrow" />
        </p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          <T k="page.tlds.title" />
        </h1>
        <p className="max-w-2xl leading-relaxed text-muted-foreground">
          <TCount k="page.tlds.desc" vars={{ n: rows.length }} />
        </p>
      </header>
      <div className="border border-border">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-1/4" />
            <col className="w-1/4" />
            <col className="w-1/4" />
            <col className="w-1/4" />
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-secondary text-left">
              <th scope="col" className="whitespace-nowrap px-2 py-3 text-[10px] font-medium text-muted-foreground sm:px-4 sm:text-xs sm:uppercase sm:tracking-widest">
                <T k="th.tld" />
              </th>
              <th scope="col" className="whitespace-nowrap px-2 py-3 text-[10px] font-medium text-muted-foreground sm:px-4 sm:text-xs sm:uppercase sm:tracking-widest">
                <T k="th.type" />
              </th>
              <th scope="col" className="whitespace-nowrap px-2 py-3 text-right text-[10px] font-medium text-muted-foreground sm:px-4 sm:text-xs sm:uppercase sm:tracking-widest">
                <T k="th.minRegister" />
              </th>
              <th scope="col" className="whitespace-nowrap px-2 py-3 text-right text-[10px] font-medium text-muted-foreground sm:px-4 sm:text-xs sm:uppercase sm:tracking-widest">
                <T k="th.registrarCount" />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-b border-border last:border-b-0 hover:bg-accent/50">
                <td className="truncate px-2 py-3.5 sm:px-4">
                  <Link href={`/tld/${t.tld}`} className="font-mono font-semibold hover:text-primary">
                    .{t.tld}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-2 py-3.5 text-xs text-muted-foreground sm:px-4 sm:text-sm">
                  <TldType type={t.type} compact />
                </td>
                <td className="whitespace-nowrap px-2 py-3.5 text-right font-mono text-xs tabular-nums text-primary sm:px-4 sm:text-sm">
                  <Money value={t.minRegister} from="USD" />
                </td>
                <td className="whitespace-nowrap px-2 py-3.5 text-right font-mono text-xs tabular-nums text-muted-foreground sm:px-4 sm:text-sm">
                  {t.registrarCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
