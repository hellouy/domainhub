import { put } from "@vercel/blob"
import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { registrars } from "@/lib/db/schema"

export const runtime = "nodejs"

const MAX_ICON_BYTES = 256 * 1024
const LONG_CACHE = "public, max-age=31536000, immutable"
const SHORT_CACHE = "public, max-age=3600"
const CONTENT_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
}

function redirectToBlob(url: string) {
  return NextResponse.redirect(url, {
    status: 307,
    headers: { "Cache-Control": LONG_CACHE },
  })
}

function notFound() {
  return new NextResponse(null, {
    status: 404,
    headers: { "Cache-Control": SHORT_CACHE },
  })
}

function getHostname(website: string) {
  try {
    const normalized = /^https?:\/\//i.test(website) ? website : `https://${website}`
    const url = new URL(normalized)
    const hostname = url.hostname.toLowerCase()
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      !hostname.includes(".") ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost")
    ) {
      return null
    }
    return hostname
  } catch {
    return null
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return notFound()

  try {
    const [registrar] = await db
      .select({ website: registrars.website, faviconUrl: registrars.faviconUrl })
      .from(registrars)
      .where(and(eq(registrars.slug, slug), eq(registrars.isActive, true)))
      .limit(1)

    if (!registrar) return notFound()
    if (registrar.faviconUrl) return redirectToBlob(registrar.faviconUrl)

    const hostname = getHostname(registrar.website)
    if (!hostname) return notFound()

    const faviconRequest = new URL("https://www.google.com/s2/favicons")
    faviconRequest.searchParams.set("domain", hostname)
    faviconRequest.searchParams.set("sz", "64")

    const response = await fetch(faviconRequest, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(6000),
    })
    if (!response.ok) return notFound()

    const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? ""
    const extension = CONTENT_TYPES[contentType]
    const declaredSize = Number(response.headers.get("content-length"))
    if (!extension || (declaredSize > 0 && declaredSize > MAX_ICON_BYTES)) return notFound()

    const icon = Buffer.from(await response.arrayBuffer())
    if (icon.length === 0 || icon.length > MAX_ICON_BYTES) return notFound()

    const blob = await put(`registrar-favicons/${slug}.${extension}`, icon, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 31536000,
      contentType,
    })

    await db.update(registrars).set({ faviconUrl: blob.url }).where(eq(registrars.slug, slug))

    return redirectToBlob(blob.url)
  } catch (error) {
    console.error(`[registrar-favicon] Failed to resolve icon for ${slug}:`, error)
    return new NextResponse(null, {
      status: 503,
      headers: { "Cache-Control": SHORT_CACHE },
    })
  }
}
