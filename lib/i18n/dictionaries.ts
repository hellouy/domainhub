export type Locale = "zh" | "en"

export const LOCALES: Locale[] = ["zh", "en"]
export const DEFAULT_LOCALE: Locale = "zh"
export const LOCALE_COOKIE = "dh_locale"

export const LOCALE_LABELS: Record<Locale, string> = {
  zh: "中文",
  en: "English",
}

/**
 * 站点文案词典。
 * 键按区块分组：nav / home / search / price / footer / common。
 * 动态数据（价格、后缀名、注册商名）不在此翻译。
 */
const zh = {
    common: {
      brandTagline: "全球域名价格聚合",
      viewAll: "查看全部",
      allTlds: "全部后缀",
      registrars: "注册商",
      loading: "加载中…",
      registrarsUnit: "家注册商",
      tldsUnit: "个后缀",
      updatedAt: "更新于",
      justNow: "刚刚",
    },
    nav: {
      allTlds: "全部后缀",
      registrars: "注册商",
      openMenu: "打开菜单",
      closeMenu: "关闭菜单",
      language: "语言",
      currency: "货币",
    },
    home: {
      heroKicker: "全球域名价格聚合",
      heroTitleLine1: "注册域名前，",
      heroTitleLine2: "先比一次价。",
      heroDescription:
        "DomainHub 汇集 {registrars} 家主流注册商、{tlds} 个常用后缀的注册、续费与转入价格，让你避开首年低价陷阱，找到长期最划算的注册商。",
      statRegistrars: "注册商",
      statTlds: "域名后缀",
      statPrices: "价格记录",
      statUpdated: "最近更新",
      popularTitle: "热门后缀",
      popularHint: "点按卡片即可展开各注册商比价",
      registrarsTitle: "收录的注册商",
      lowestRegister: "最低注册价",
      tapToCompare: "点按比价",
      tapToCollapse: "收起",
      viewFullCompare: "查看完整比价",
      register: "注册",
      renew: "续费",
      transfer: "转入",
      cheapest: "最低",
      noPrices: "暂无价格数据",
    },
    search: {
      placeholder: "搜索域名后缀，如 com、io、ai",
      ariaLabel: "搜索域名后缀",
      button: "比价",
      suggestionsLabel: "后缀建议",
      lowestPrefix: "最低",
      noPrice: "暂无价格",
    },
    footer: {
      description: "聚合全球主流域名注册商的注册、续费与转入价格，帮助你在注册前找到最划算的选择。",
      browse: "浏览",
      hotCompare: "热门比价",
      compareCom: ".com 比价",
      compareIo: ".io 比价",
      compareAi: ".ai 比价",
      disclaimer: "价格数据仅供参考，请以注册商官网为准。",
    },
}

export type Dictionary = typeof zh

const en: Dictionary = {
    common: {
      brandTagline: "Global domain price aggregator",
      viewAll: "View all",
      allTlds: "All TLDs",
      registrars: "Registrars",
      loading: "Loading…",
      registrarsUnit: "registrars",
      tldsUnit: "TLDs",
      updatedAt: "Updated",
      justNow: "just now",
    },
    nav: {
      allTlds: "All TLDs",
      registrars: "Registrars",
      openMenu: "Open menu",
      closeMenu: "Close menu",
      language: "Language",
      currency: "Currency",
    },
    home: {
      heroKicker: "Global domain price aggregator",
      heroTitleLine1: "Before you register,",
      heroTitleLine2: "compare the price.",
      heroDescription:
        "DomainHub gathers registration, renewal and transfer prices from {registrars} major registrars across {tlds} popular TLDs, helping you dodge first-year teaser deals and find the best long-term value.",
      statRegistrars: "Registrars",
      statTlds: "TLDs",
      statPrices: "Price records",
      statUpdated: "Last updated",
      popularTitle: "Popular TLDs",
      popularHint: "Tap a card to expand the registrar comparison",
      registrarsTitle: "Tracked registrars",
      lowestRegister: "Lowest register",
      tapToCompare: "Compare",
      tapToCollapse: "Collapse",
      viewFullCompare: "View full comparison",
      register: "Register",
      renew: "Renew",
      transfer: "Transfer",
      cheapest: "Lowest",
      noPrices: "No price data yet",
    },
    search: {
      placeholder: "Search a TLD, e.g. com, io, ai",
      ariaLabel: "Search domain extension",
      button: "Compare",
      suggestionsLabel: "TLD suggestions",
      lowestPrefix: "from",
      noPrice: "No price",
    },
    footer: {
      description:
        "Aggregating registration, renewal and transfer prices from major domain registrars worldwide, so you find the best deal before you register.",
      browse: "Browse",
      hotCompare: "Popular comparisons",
      compareCom: ".com prices",
      compareIo: ".io prices",
      compareAi: ".ai prices",
      disclaimer: "Prices are for reference only. Always confirm on the registrar's official site.",
    },
}

const dictionaries: Record<Locale, Dictionary> = { zh, en }

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE]
}

export function normalizeLocale(value: string | undefined | null): Locale {
  return value === "en" ? "en" : "zh"
}
