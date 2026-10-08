"use client"

import Image from "next/image"
import { useState } from "react"
import { Globe2 } from "lucide-react"

export function RegistrarIcon({
  slug,
  name,
  size = "default",
}: {
  slug: string
  name: string
  size?: "compact" | "default" | "large"
}) {
  const [hasError, setHasError] = useState(false)
  const faviconUrl = `/api/registrars/${encodeURIComponent(slug)}/favicon?v=2`
  const iconSize = size === "large" ? "size-14" : size === "compact" ? "size-10" : "size-12"

  return (
    <span
      aria-hidden="true"
      className={`flex ${iconSize} shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-background text-primary shadow-sm`}
    >
      {faviconUrl && !hasError ? (
        <Image
          src={faviconUrl}
          alt=""
          width={36}
          height={36}
          unoptimized
          loading="lazy"
          referrerPolicy="no-referrer"
          className={size === "large" ? "size-9 object-contain" : size === "compact" ? "size-6 object-contain" : "size-8 object-contain"}
          onError={() => setHasError(true)}
        />
      ) : name.trim() ? (
        <span className={size === "large" ? "text-xl font-semibold" : size === "compact" ? "text-base font-semibold" : "text-lg font-semibold"}>
          {name.trim().slice(0, 1).toUpperCase()}
        </span>
      ) : (
        <Globe2 aria-hidden="true" className="size-5" />
      )}
    </span>
  )
}
