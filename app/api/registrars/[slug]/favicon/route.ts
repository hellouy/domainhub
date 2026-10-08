import { and, eq, isNull, or } from "drizzle-orm"
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

function imageResponse(body: BodyInit, contentType: string) {
  return new NextResponse(body, {
    headers: {
      "Cache-Control": LONG_CACHE,
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
    },
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
      .select({
        website: registrars.website,
        faviconData: registrars.faviconData,
        faviconContentType: registrars.faviconContentType,
      })
      .from(registrars)
      .where(and(eq(registrars.slug, slug), eq(registrars.isActive, true)))
      .limit(1)

    if (!registrar) return notFound()

    // 命中 DB 缓存直接返回（immutable 一年）
    if (registrar.faviconData && registrar.faviconContentType) {
      return imageResponse(new Uint8Array(registrar.faviconData), registrar.faviconContentType)
    }

    const hostname = getHostname(registrar.website)
    if (!hostname) return notFound()

    const faviconRequest = new URL("https://www.google.com/s2/favicons")
    faviconRequest.searchParams.set("domain", hostname)
    faviconRequest.searchParams.set("sz", "64")

    const response = await fetch(faviconRequest, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    })
    if (!response.ok) return notFound()

    const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? ""
    const extension = CONTENT_TYPES[contentType]
    const declaredSize = Number(response.headers.get("content-length"))
    if (!extension || (declaredSize > 0 && declaredSize > MAX_ICON_BYTES)) return notFound()

    const icon = Buffer.from(await response.arrayBuffer())
    if (icon.length === 0 || icon.length > MAX_ICON_BYTES) return notFound()

    // 写入 DB 缓存
    await db
      .update(registrars)
      .set({
        faviconData: icon,
        faviconContentType: contentType,
        faviconUpdatedAt: new Date(),
      })
      .where(
        and(
          eq(registrars.slug, slug),
          or(isNull(registrars.faviconData), isNull(registrars.faviconUpdatedAt)),
        ),
      )

    return imageResponse(new Uint8Array(icon), contentType)
  } catch (error) {
    console.error(`[registrar-favicon] Failed to resolve icon for ${slug}:`, error)
    const cause = (error as { cause?: unknown })?.cause
    const causeMsg = cause instanceof Error ? `${cause.name}: ${cause.message}` : cause ? String(cause) : null
    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        cause: causeMsg,
      }),
      {
        status: 503,
        headers: { "Cache-Control": SHORT_CACHE, "Content-Type": "application/json" },
      },
    )
  }
}