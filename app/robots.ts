import type { MetadataRoute } from "next"

/** 正式域名固定为 tldbi.com,保证搜索引擎收录地址一致 */
function getBaseUrl() {
  return "https://tldbi.com"
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/"],
      },
    ],
    sitemap: `${getBaseUrl()}/sitemap.xml`,
  }
}
