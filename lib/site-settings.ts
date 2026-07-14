import "server-only"

import { unstable_cache, revalidateTag } from "next/cache"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { siteSettings, type SiteSettingsRow } from "@/lib/db/schema"
import type { Locale } from "@/lib/i18n"

export const SITE_SETTINGS_TAG = "site-settings"

export type SiteSettings = {
  brandTextMain: string
  brandTextAccent: string
  brandSuffix: string
  logoUrl: string
  faviconUrl: string
  titleZh: string
  titleEn: string
  descriptionZh: string
  descriptionEn: string
  footerDisclaimerZh: string
  footerDisclaimerEn: string
}

/** 内置默认值:数据库无记录或字段为空时回退到这里 */
export const SITE_SETTINGS_DEFAULTS: SiteSettings = {
  brandTextMain: "TLD",
  brandTextAccent: "bi",
  brandSuffix: ".com",
  logoUrl: "",
  faviconUrl: "",
  titleZh: "tldbi.com — 全球域名后缀比价 · 注册/续费/转入最低价查询",
  titleEn: "tldbi.com — Global domain TLD price comparison",
  descriptionZh:
    "tldbi.com 聚合 Cloudflare、Porkbun、Dynadot、Gandi 等全球主流域名注册商的实时价格，覆盖 1800+ 域名后缀的注册、续费与转入报价，一键找到最便宜的注册商。",
  descriptionEn:
    "tldbi.com aggregates real-time prices from major registrars like Cloudflare, Porkbun, Dynadot and Gandi across 1800+ TLDs — find the cheapest registrar for registration, renewal and transfer.",
  footerDisclaimerZh: "价格数据仅供参考，请以注册商官网为准。",
  footerDisclaimerEn: "Prices are for reference only. Please verify on the registrar's official site.",
}

/** 把数据库行(可能有空字段)与默认值合并成完整设置 */
function mergeWithDefaults(row: SiteSettingsRow | undefined): SiteSettings {
  if (!row) return { ...SITE_SETTINGS_DEFAULTS }
  const pick = (v: string | null | undefined, d: string) => (v && v.trim() !== "" ? v : d)
  return {
    brandTextMain: pick(row.brandTextMain, SITE_SETTINGS_DEFAULTS.brandTextMain),
    brandTextAccent: pick(row.brandTextAccent, SITE_SETTINGS_DEFAULTS.brandTextAccent),
    brandSuffix: pick(row.brandSuffix, SITE_SETTINGS_DEFAULTS.brandSuffix),
    // 图片为空是合法的(表示不使用图片),不回退默认
    logoUrl: row.logoUrl ?? "",
    faviconUrl: row.faviconUrl ?? "",
    titleZh: pick(row.titleZh, SITE_SETTINGS_DEFAULTS.titleZh),
    titleEn: pick(row.titleEn, SITE_SETTINGS_DEFAULTS.titleEn),
    descriptionZh: pick(row.descriptionZh, SITE_SETTINGS_DEFAULTS.descriptionZh),
    descriptionEn: pick(row.descriptionEn, SITE_SETTINGS_DEFAULTS.descriptionEn),
    footerDisclaimerZh: pick(row.footerDisclaimerZh, SITE_SETTINGS_DEFAULTS.footerDisclaimerZh),
    footerDisclaimerEn: pick(row.footerDisclaimerEn, SITE_SETTINGS_DEFAULTS.footerDisclaimerEn),
  }
}

/** 读取站点设置(带缓存,按 SITE_SETTINGS_TAG 失效)。数据库不可用时回退默认值,永不抛错。 */
export const getSiteSettings = unstable_cache(
  async (): Promise<SiteSettings> => {
    try {
      const [row] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1)
      return mergeWithDefaults(row)
    } catch {
      return { ...SITE_SETTINGS_DEFAULTS }
    }
  },
  ["site-settings-v1"],
  { tags: [SITE_SETTINGS_TAG] },
)

/** 让站点设置缓存立即失效(保存后调用) */
export function invalidateSiteSettings() {
  revalidateTag(SITE_SETTINGS_TAG, "max")
}

/** 按语言取标题 */
export function localizedTitle(s: SiteSettings, locale: Locale) {
  return locale === "en" ? s.titleEn : s.titleZh
}

/** 按语言取描述 */
export function localizedDescription(s: SiteSettings, locale: Locale) {
  return locale === "en" ? s.descriptionEn : s.descriptionZh
}
