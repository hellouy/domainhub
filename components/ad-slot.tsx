"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { useLocale } from "@/components/providers"
import { ArrowUpRight } from "lucide-react"
import type { PublicAd } from "@/lib/ads"

/**
 * 通用广告位组件：支持文字 / 图片两种类型，文案随当前语言切换。
 * 服务端通过 getActiveAdsByPosition 取数据后传入 ads prop。
 * 多条广告时自动轮播，底部显示指示点，悬停暂停。
 */
export function AdSlot({ ads }: { ads: PublicAd[] }) {
  const { locale } = useLocale()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const adCount = ads?.length ?? 0

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % adCount)
  }, [adCount])

  useEffect(() => {
    if (paused || adCount <= 1) return
    const id = setInterval(goNext, 5000)
    return () => clearInterval(id)
  }, [paused, adCount, goNext])

  if (adCount === 0) return null

  const currentAd = ads[currentIndex]
  const title = locale === "en" && currentAd.titleEn ? currentAd.titleEn : currentAd.titleZh
  const subtitle = locale === "en" && currentAd.subtitleEn ? currentAd.subtitleEn : currentAd.subtitleZh

  if (!title && currentAd.type === "text") return null

  if (adCount === 1) {
    return <AdContent ad={currentAd} title={title} subtitle={subtitle} />
  }

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <AdContent ad={currentAd} title={title} subtitle={subtitle} />
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        {ads.map((_, i) => (
          <span
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
              i === currentIndex ? "bg-primary w-4" : "bg-muted-foreground/30 w-1.5 hover:bg-muted-foreground/50"
            }`}
          />
        ))}
      </div>
    </div>
  )
}

function AdContent({
  ad,
  title,
  subtitle,
}: {
  ad: PublicAd
  title: string
  subtitle?: string | null
}) {
  if (ad.type === "image" && ad.imageUrl) {
    return (
      <Link
        href={ad.linkUrl || "#"}
        {...(ad.openInNewTab ? { target: "_blank" } : {})}
        rel={ad.rel}
        className="block overflow-hidden rounded-lg border border-border transition-opacity hover:opacity-90"
      >
        <Image
          src={ad.imageUrl}
          alt={ad.imageAlt || title || "advertisement"}
          width={728}
          height={90}
          className="h-auto w-full"
          unoptimized
        />
      </Link>
    )
  }

  return (
    <Link
      href={ad.linkUrl || "#"}
      {...(ad.openInNewTab ? { target: "_blank" } : {})}
      rel={ad.rel}
      className="inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2 text-sm font-medium text-primary transition-colors hover:border-primary/30 hover:bg-muted/50"
    >
      <span className="font-semibold">{title}</span>
      {subtitle && <span className="text-muted-foreground">{subtitle}</span>}
      <ArrowUpRight aria-hidden="true" className="size-4" />
    </Link>
  )
}
