/**
 * 后缀分类（通用 / 国家）唯一真源。
 *
 * 语义（与前台 tab 对齐）：
 * - 通用 (gTLD)：已开放 / 可注册的通用后缀，含传统 gTLD、已上线的新 gTLD、以及可注册的 IDN gTLD；
 * - 国家 (ccTLD)：国家 / 地区后缀，含 ASCII 两字母、IDN ccTLD、以及国家二级后缀（co.uk、com.br 等）；
 * - 新顶级 (newG)：尚未开放、以 ICANN 申请数据为准，由 scripts/sync-new-gtlds.ts 显式写入，不由本函数产出。
 *
 * 注意：本函数只对「已在 IANA 委派」的后缀分类，返回 gTLD 或 ccTLD。
 */

/** 传统通用顶级域（2012 新顶级计划之前），其余已委派非国家后缀均归通用。 */
export const LEGACY_GTLDS = new Set([
  "com", "net", "org", "info", "biz", "name", "pro", "mobi", "asia", "tel",
  "xxx", "cat", "jobs", "travel", "aero", "coop", "museum", "int", "gov",
  "edu", "mil", "arpa", "post",
])

/**
 * IDN ccTLD 末级标签集合（来自 IANA Root DB 的 Country-code 判定）。
 * 仅需包含「末级标签」即可覆盖 co.uk / обр.срб 之类的二级国家后缀。
 * 数据源：https://www.iana.org/domains/root/db/<punycode>.html
 */
export const IDN_CC_TLDS = new Set([
  "бел", "қаз", "ευ", "ею", "ελ", "срб", "рф", "укр", "мкд",
  "السعودية", "امارات", "ישראל", "سورية", "فلسطين", "البحرين", "مصر", "قطر", "تونس", "بارت",
  "ڀارت", "بھارت",
  "भारत", "भारतम्", "भारोत", "ভারত", "ভাৰত",
  "ଭାରତ", "ભારત", "ਭਾਰਤ", "இந்தியா", "சிங்கப்பூர்", "இலங்கை", "ಭಾರತ", "ලංකා", "ഭാരതം", "భారత్",
  "ไทย", "한국", "中国", "台灣", "台湾", "澳門", "新加坡", "香港",
])

/** 取后缀的末级标签（如 co.uk → uk、обр.срб → срб）。 */
export function lastLabel(tld: string): string {
  const parts = tld.toLowerCase().split(".")
  return parts[parts.length - 1] ?? tld.toLowerCase()
}

/**
 * 对已在 IANA 委派的后缀判定分类。
 * - 两字母 ASCII → ccTLD（ICANN 规则，含 com.br/co.uk 等二级国家域）
 * - IDN ccTLD → ccTLD
 * - 其余 → gTLD（传统 gTLD、已上线新 gTLD、可注册 IDN gTLD）
 */
export function classifyDelegated(tld: string): "gTLD" | "ccTLD" {
  const last = lastLabel(tld)
  if (/^[a-z]{2}$/.test(last)) return "ccTLD"
  if (IDN_CC_TLDS.has(last)) return "ccTLD"
  return "gTLD"
}
