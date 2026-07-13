import type { Locale } from "@/lib/i18n"

/**
 * 注册商双语介绍(按 slug)。
 * - 数据库里原有中文描述,这里补齐英文并统一维护双语版本。
 * - 未收录的 slug 回退到数据库描述(中文场景)或空串(英文场景)。
 */
export const REGISTRAR_CONTENT: Record<string, { zh: string; en: string }> = {
  cloudflare: {
    zh: "以成本价销售域名，无加价，免费 WHOIS 隐私保护与 DNSSEC。",
    en: "Sells domains at wholesale cost with zero markup, plus free WHOIS privacy and DNSSEC.",
  },
  dynadot: {
    zh: "价格稳定的注册商，支持中文界面，提供免费隐私保护。",
    en: "Stable pricing with a Chinese-language interface and free privacy protection.",
  },
  godaddy: {
    zh: "全球最大域名注册商，产品线丰富，续费价格偏高。",
    en: "The world's largest registrar with a broad product line, though renewal prices run high.",
  },
  namecom: {
    zh: "界面友好的美国注册商，常有促销活动。",
    en: "A user-friendly US registrar that frequently runs promotions.",
  },
  namecheap: {
    zh: "老牌注册商，首年促销力度大，免费终身 WHOIS 隐私保护。",
    en: "A long-established registrar with strong first-year deals and free lifetime WHOIS privacy.",
  },
  porkbun: {
    zh: "价格透明的独立注册商，赠送 WHOIS 隐私与 SSL 证书。",
    en: "A transparent independent registrar that bundles free WHOIS privacy and SSL certificates.",
  },
  spaceship: {
    zh: "Namecheap 旗下新品牌，主打低价与现代化管理面板。",
    en: "Namecheap's newer brand focused on low prices and a modern management dashboard.",
  },
  aliyun: {
    zh: "国内最大域名注册商，支持备案与国内解析生态。",
    en: "China's largest registrar, with ICP filing support and a domestic DNS ecosystem.",
  },
}

/** 取本地化描述:英文缺失时回退空串,中文回退数据库描述 */
export function registrarDescription(slug: string, dbDesc: string, locale: Locale): string {
  const entry = REGISTRAR_CONTENT[slug]
  if (locale === "en") return entry?.en ?? ""
  return entry?.zh ?? dbDesc ?? ""
}
