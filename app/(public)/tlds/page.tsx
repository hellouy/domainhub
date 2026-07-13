import type { Metadata } from "next"
import Link from "next/link"
import { TLD_TYPE_LABELS } from "@/lib/format"
import { Money } from "@/components/money"
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 md:px-6">
      <header className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">索引</p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">全部域名后缀</h1>
        <p className="max-w-2xl leading-relaxed text-muted-foreground">
          共收录 {rows.length} 个后缀，点击任意后缀查看各注册商的详细价格。
        </p>
      </header>
      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary text-left">
              <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                后缀
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                类型
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                最低注册价
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                注册商数
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-b border-border last:border-b-0 hover:bg-accent/50">
                <td className="px-4 py-3.5">
                  <Link href={`/tld/${t.tld}`} className="font-mono font-semibold hover:text-primary">
                    .{t.tld}
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-muted-foreground">{TLD_TYPE_LABELS[t.type] ?? t.type}</td>
                <td className="px-4 py-3.5 text-right font-mono tabular-nums text-primary">
                  <Money value={t.minRegister} from="USD" />
                </td>
                <td className="px-4 py-3.5 text-right font-mono tabular-nums text-muted-foreground">
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
