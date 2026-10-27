"use client"

import Link from "next/link"
import Image from "next/image"
import { useLocale } from "@/components/providers"
import { ArrowUpRight } from "lucide-react"
import type { PublicAd } from "@/lib/ads"

/**
 * 通用广告位组件：支持文字 / 图片两种类型，文案随当前语言切换。
 * 服务端通过 getActiveAdsByPosition 取数据后传入 ads prop。
 * 无广告时不渲染任何内容（返回 null）。
 */
export function AdSlot({ ads }: { ads: PublicAd[] }) {
  const { locale } = useLocale()

  if (!ads || ads.length === 0) return null

  const ad = ads[0] // 当前只展示第一条（weight 最高）；未来可扩展轮播

  const title = locale === "en" && ad.titleEn ? ad.titleEn : ad.titleZh
  const subtitle = locale === "en" && ad.subtitleEn ? ad.subtitleEn : ad.subtitleZh

  // 兜底：标题都没有则不展示
  if (!title && ad.type === "text") return null

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

  // 文字广告
  return (
    <Link
      href={ad.linkUrl || "#"}
      {...(ad.openInNewTab ? { target: "_blank" } : {})}
      rel={ad.rel}
      className="inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2 text-sm font-medium text-primary transition-colors hover:border-primary/30 hover:bg-muted/50"
    >
      <span className="font-semibold">{title}</span>
      {subtitle && (
        <span className="text-muted-foreground">{subtitle}</span>
      )}
      <ArrowUpRight aria-hidden="true" className="size-4" />
    </Link>
  )
}
