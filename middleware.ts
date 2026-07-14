import { NextResponse, type NextRequest } from "next/server"

const LOCALE_COOKIE = "tldbi_locale"

/**
 * 首访按 IP 地理位置 + 浏览器语言智能判定语言,写入 cookie。
 * - 已有 cookie(用户手动选过)则完全尊重,不覆盖。
 * - 判定优先级(增强判断):
 *     1. Vercel 地理头 x-vercel-ip-country:中国大陆(CN)→ 中文,其余国家 → 英文
 *     2. 无地理信息时回退 Accept-Language:浏览器首选中文 → 中文,否则英文
 *     3. 港澳台或浏览器强中文偏好 → 中文(照顾华语用户)
 */
export function middleware(request: NextRequest) {
  const existing = request.cookies.get(LOCALE_COOKIE)?.value
  if (existing === "zh" || existing === "en") {
    return NextResponse.next()
  }

  const country = (request.headers.get("x-vercel-ip-country") || "").toUpperCase()
  const accept = (request.headers.get("accept-language") || "").toLowerCase()
  const prefersChinese = accept.trim().startsWith("zh")
  const chineseRegions = new Set(["CN", "HK", "MO", "TW"])

  let locale: "zh" | "en"
  if (country) {
    // 有地理信息:华语地区 → 中文;其他国家若浏览器强中文偏好也给中文,否则英文
    locale = chineseRegions.has(country) || prefersChinese ? "zh" : "en"
  } else {
    // 无地理信息(本地/未知):以浏览器语言为准
    locale = prefersChinese ? "zh" : "en"
  }

  // 同时写入请求(供本次 SSR 的 layout 读取)与响应(持久化到浏览器)
  request.cookies.set(LOCALE_COOKIE, locale)
  const res = NextResponse.next({ request })
  res.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 31536000,
    sameSite: "lax",
  })
  return res
}

export const config = {
  // 跳过 API、静态资源、带扩展名的文件
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
