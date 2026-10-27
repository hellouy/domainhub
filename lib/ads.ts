import "server-only"

import { unstable_cache, revalidateTag } from "next/cache"
import { and, eq, lte, gte, desc, or, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { adSlots, type AdSlotRow } from "@/lib/db/schema"
import type { Locale } from "@/lib/i18n"
import { AD_POSITIONS, positionLabel, type AdPosition } from "@/lib/ad-positions"

export { AD_POSITIONS, positionLabel, type AdPosition }

export const ADS_TAG = "ad-slots-v1"

/** 前台展示用的广告（已过滤时效，保留双语字段供客户端切换） */
export type PublicAd = {
  id: number
  position: string
  type: "text" | "image"
  titleZh: string
  titleEn: string
  subtitleZh: string
  subtitleEn: string
  imageUrl: string | null
  imageAlt: string | null
  linkUrl: string
  openInNewTab: boolean
  rel: string
}

/** 取某位置当前生效的广告（按 weight 降序），带缓存 */
export const getActiveAdsByPosition = unstable_cache(
  async (position: string): Promise<PublicAd[]> => {
    const now = new Date()
    const rows = await db
      .select()
      .from(adSlots)
      .where(
        and(
          eq(adSlots.position, position),
          eq(adSlots.isActive, true),
          or(isNull(adSlots.startsAt), lte(adSlots.startsAt, now)),
          or(isNull(adSlots.endsAt), gte(adSlots.endsAt, now)),
        ),
      )
      .orderBy(desc(adSlots.weight))
      .limit(5)

    return rows.map(toPublic)
  },
  ["ad-slots-by-position-v1"],
  { tags: [ADS_TAG] },
)

/** 取全部广告（后台用，不带缓存） */
export async function getAllAds(): Promise<AdSlotRow[]> {
  return db.select().from(adSlots).orderBy(desc(adSlots.createdAt))
}

/** 按 id 取单条（后台编辑用） */
export async function getAdById(id: number): Promise<AdSlotRow | undefined> {
  const [row] = await db.select().from(adSlots).where(eq(adSlots.id, id)).limit(1)
  return row
}

function toPublic(row: AdSlotRow): PublicAd {
  return {
    id: row.id,
    position: row.position,
    type: row.type as "text" | "image",
    titleZh: row.titleZh,
    titleEn: row.titleEn,
    subtitleZh: row.subtitleZh,
    subtitleEn: row.subtitleEn,
    imageUrl: row.imageUrl,
    imageAlt: row.imageAlt,
    linkUrl: row.linkUrl,
    openInNewTab: row.openInNewTab,
    rel: row.rel,
  }
}

/** 让广告缓存立即失效（后台保存/删除后调用） */
export function invalidateAds() {
  revalidateTag(ADS_TAG, "max")
}

/** 按 locale 取标题 */
export function localizedAdTitle(row: AdSlotRow, locale: Locale): string {
  return locale === "en" ? row.titleEn || row.titleZh : row.titleZh || row.titleEn
}

/** 按 locale 取副文案 */
export function localizedAdSubtitle(row: AdSlotRow, locale: Locale): string {
  return locale === "en" ? row.subtitleEn || row.subtitleZh : row.subtitleZh || row.subtitleEn
}