import type { MetadataRoute } from "next"
import { db } from "@/lib/db"
import { registrars, tlds } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

/** 正式域名固定为 tldbi.com,保证搜索引擎收录地址一致 */
function getBaseUrl() {
  return "https://tldbi.com"
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getBaseUrl()
  const [allTlds, activeRegistrars] = await Promise.all([
    db.select({ tld: tlds.tld }).from(tlds),
    db.select({ slug: registrars.slug }).from(registrars).where(eq(registrars.isActive, true)),
  ])

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/tlds`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/registrars`, changeFrequency: "weekly", priority: 0.8 },
  ]

  // /compare/[tld] 已 301 到 /tld/[tld],不再进 sitemap
  const tldRoutes: MetadataRoute.Sitemap = allTlds.map((t) => ({
    url: `${base}/tld/${t.tld}`,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }))

  const registrarRoutes: MetadataRoute.Sitemap = activeRegistrars.map((r) => ({
    url: `${base}/registrars/${r.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }))

  return [...staticRoutes, ...tldRoutes, ...registrarRoutes]
}
