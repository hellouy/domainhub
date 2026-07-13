import { HomeContent } from "@/components/home/home-content"
import {
  getActiveRegistrars,
  getPopularTldsWithPrices,
  getStats,
  getTldsWithMinPrice,
} from "@/lib/db/queries"

export const revalidate = 300

export default async function HomePage() {
  const [stats, allTlds, popularTlds, registrarList] = await Promise.all([
    getStats(),
    getTldsWithMinPrice(),
    getPopularTldsWithPrices(),
    getActiveRegistrars(),
  ])

  const searchOptions = allTlds.map((t) => ({
    tld: t.tld,
    type: t.type,
    minRegister: t.minRegister,
  }))

  const registrars = registrarList.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    tldCount: r.tldCount,
  }))

  return (
    <HomeContent
      stats={{
        registrarCount: stats.registrarCount,
        tldCount: stats.tldCount,
        priceCount: stats.priceCount,
        lastUpdated: stats.lastUpdated ? new Date(stats.lastUpdated).toISOString() : null,
      }}
      popularTlds={popularTlds}
      registrars={registrars}
      searchOptions={searchOptions}
    />
  )
}
