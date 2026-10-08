import type { Metadata } from "next"
import { DealsList } from "@/components/deals-list"
import { T } from "@/components/i18n-text"
import { queryDeals } from "@/services/prices"

export const revalidate = 300

export const metadata: Metadata = {
  title: "域名优惠码与促销价格",
  description: "浏览正在生效的域名注册优惠价和优惠码，比较各家注册商活动后的实际价格。",
  alternates: { canonical: "/deals" },
}

export default async function DealsPage() {
  const deals = await queryDeals({ onlyActive: true, limit: 200 })

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:py-12 md:px-6">
      <header className="flex flex-col gap-3 border-b border-border pb-6 sm:pb-8">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">T L D B I / DEALS</p>
        <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          <T k="deals.title" />
        </h1>
        <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          <T k="deals.description" />
        </p>
      </header>
      <DealsList deals={deals} />
    </div>
  )
}
