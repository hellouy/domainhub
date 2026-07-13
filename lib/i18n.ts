/**
 * 轻量多语言方案:中文(默认)+ 英文。
 * - UI 文案全部经 dict 取值,新增语言只需扩充 DICTS。
 * - 语言偏好存 cookie(tldbi_locale),客户端 LocaleProvider 读写。
 */
export type Locale = "zh" | "en"

export const DEFAULT_LOCALE: Locale = "zh"
export const LOCALE_COOKIE = "tldbi_locale"

const zh = {
  // 页头
  "nav.tlds": "全部后缀",
  "nav.registrars": "注册商",
  "nav.themeToggle": "切换深浅色",
  "nav.langToggle": "Switch to English",
  // 首页 Hero
  "hero.eyebrow": "全球域名价格聚合",
  "hero.title": "注册域名前，先比一次价。",
  "hero.subtitle": "汇集 {r} 家注册商、{t} 个后缀的注册、续费与转入价格，避开首年低价陷阱。",
  "hero.stat.tlds": "域名后缀",
  "hero.stat.registrars": "注册商",
  "hero.stat.prices": "价格记录",
  "hero.stat.updated": "最近更新",
  // 区块标题
  "section.explorer": "浏览后缀价格",
  "section.registrars": "收录的注册商",
  "section.tldCount": "后缀",
  // 搜索框
  "search.placeholder": "搜索域名后缀，如 com、io、ai…",
  "search.button": "比价",
  "search.noResult": "未找到该后缀",
  // 后缀浏览器
  "explorer.title": "浏览后缀价格",
  "explorer.tab.popular": "热门",
  "explorer.tab.all": "全部",
  "explorer.tab.gtld": "通用",
  "explorer.tab.cctld": "国家",
  "explorer.tab.newg": "新顶级",
  "explorer.filter": "筛选后缀…",
  "explorer.hint": "个后缀 · 点击后缀直接查看报价",
  "explorer.loadMore": "加载更多",
  "explorer.empty": "没有匹配的后缀",
  "explorer.panel.register": "注册",
  "explorer.panel.renew": "续费",
  "explorer.panel.visit": "官网",
  "explorer.panel.full": "完整比价",
  "explorer.panel.close": "收起",
  "explorer.panel.loading": "加载报价中…",
  "explorer.panel.lowest": "最低报价",
  "explorer.panel.noData": "暂无该后缀的价格数据",
  "explorer.showMore": "显示更多（还有 {n} 个）",
  // 注册商区块
  "registrars.title": "收录注册商",
  "registrars.viewAll": "查看全部",
  // 页脚
  "footer.disclaimer": "价格数据仅供参考，请以注册商官网为准。",
  "footer.nav": "站内导航",
  "footer.about": "关于",
  "footer.desc": "聚合全球主流域名注册商的注册、续费与转入价格，帮助你在注册前找到最划算的选择。",
  "footer.browse": "浏览",
  "footer.popular": "热门比价",
} as const

export type DictKey = keyof typeof zh

const en: Record<DictKey, string> = {
  "nav.tlds": "All TLDs",
  "nav.registrars": "Registrars",
  "nav.themeToggle": "Toggle theme",
  "nav.langToggle": "切换为中文",
  "hero.eyebrow": "Global domain price aggregation",
  "hero.title": "Compare prices before you register.",
  "hero.subtitle":
    "Register, renew and transfer prices across {r} registrars and {t} TLDs — never get burned by first-year teaser pricing.",
  "hero.stat.tlds": "TLDs",
  "hero.stat.registrars": "Registrars",
  "hero.stat.prices": "Price records",
  "hero.stat.updated": "Last updated",
  "section.explorer": "Browse TLD prices",
  "section.registrars": "Registrars",
  "section.tldCount": "TLDs",
  "search.placeholder": "Search a TLD, e.g. com, io, ai…",
  "search.button": "Compare",
  "search.noResult": "TLD not found",
  "explorer.title": "Browse TLD prices",
  "explorer.tab.popular": "Popular",
  "explorer.tab.all": "All",
  "explorer.tab.gtld": "Generic",
  "explorer.tab.cctld": "Country",
  "explorer.tab.newg": "New gTLD",
  "explorer.filter": "Filter TLDs…",
  "explorer.hint": "TLDs · tap any TLD to see quotes",
  "explorer.loadMore": "Load more",
  "explorer.empty": "No matching TLDs",
  "explorer.panel.register": "Register",
  "explorer.panel.renew": "Renew",
  "explorer.panel.visit": "Visit",
  "explorer.panel.full": "Full comparison",
  "explorer.panel.close": "Close",
  "explorer.panel.loading": "Loading quotes…",
  "explorer.panel.lowest": "Lowest quotes",
  "explorer.panel.noData": "No price data for this TLD yet",
  "explorer.showMore": "Show more ({n} left)",
  "registrars.title": "Registrars",
  "registrars.viewAll": "View all",
  "footer.disclaimer": "Prices are for reference only — always confirm on the registrar's site.",
  "footer.nav": "Navigation",
  "footer.about": "About",
  "footer.desc":
    "Aggregated register, renew and transfer prices from major registrars worldwide — find the best deal before you buy.",
  "footer.browse": "Browse",
  "footer.popular": "Popular",
}

const DICTS: Record<Locale, Record<DictKey, string>> = { zh, en }

export function getDict(locale: Locale) {
  return DICTS[locale] ?? DICTS[DEFAULT_LOCALE]
}
