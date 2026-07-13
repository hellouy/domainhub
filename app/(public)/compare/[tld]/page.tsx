import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { PriceTable } from "@/components/price-table"
import { getPricesForTld, getTldByName } from "@/lib/db/queries"
import { currencyService } from "@/services/currency"

export const revalidate = 300

type Props = { params: Promise<{ tld: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tld } = await params
  const row = await getTldByName(decodeURIComponent(tld))
  if (!row) return { title: "未找到该后缀" }
  return {
    title: `.${row.tld} 域名比价 — ${new Date().getFullYear()} 年最便宜的 .${row.tld} 注册商`,
    description: `按注册价、续费价、转入价排序比较所有注册商的 .${row.tld} 域名价格，一眼找到最划算的选择。`,
    alternates: { canonical: `/compare/${row.tld}` },
  }
}

export default async function ComparePage({ params }: Props) {
  const { tld } = await params
  const row = await getTldByName(decodeURIComponent(tld))
  if (!row) notFound()

  const [priceRows, convert] = await Promise.all([getPricesForTld(row.id), currencyService.getConverter()])
  const rowsWithUsd = priceRows.map((p) => ({
    ...p,
    registerUsd: convert(p.registerPrice, p.currency),
    renewUsd: convert(p.renewPrice, p.currency),
    transferUsd: convert(p.transferPrice, p.currency),
  }))

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 md:px-6">
      <nav aria-label="面包屑" className="text-xs text-muted-foreground">
        <Link href="/" className="hover:text-primary">
          首页
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href={`/tld/${row.tld}`} className="hover:text-primary">
          .{row.tld}
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">比价</span>
      </nav>
      <header className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">价格比较</p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          <span className="font-mono">.{row.tld}</span> 域名比价
        </h1>
        <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
          共收录 {priceRows.length} 家注册商的价格，点击排序按钮切换注册价、续费价、转入价排序。
          高亮数字为该项最低价。非 USD 价格（如 EUR）已按当日汇率换算后统一比价。
        </p>
      </header>
      <PriceTable rows={rowsWithUsd} />
      <p className="text-xs leading-relaxed text-muted-foreground">
        提示：许多注册商首年注册价格低廉，但续费价格明显更高。若计划长期持有，请重点比较续费价。
      </p>
    </div>
  )
}
