import type { MetadataRoute } from "next"
import { db } from "@/lib/db"
import { registrars, tlds } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

function getBaseUrl() {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
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

  const tldRoutes: MetadataRoute.Sitemap = allTlds.flatMap((t) => [
    { url: `${base}/tld/${t.tld}`, changeFrequency: "daily" as const, priority: 0.8 },
    { url: `${base}/compare/${t.tld}`, changeFrequency: "daily" as const, priority: 0.7 },
  ])

  const registrarRoutes: MetadataRoute.Sitemap = activeRegistrars.map((r) => ({
    url: `${base}/registrars/${r.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }))

  return [...staticRoutes, ...tldRoutes, ...registrarRoutes]
}
