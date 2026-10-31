import type { MetadataRoute } from "next"

/** 正式域名固定为 tldbi.com,保证搜索引擎收录地址一致 */
function getBaseUrl() {
  return "https://tldbi.com"
}

export default function robots(): MetadataRoute.Robots {
  const base = getBaseUrl()
  const disallow = ["/admin", "/admin/", "/api/"]

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow,
      },
      // 主流搜索爬虫:全量放行内容页,屏蔽后台与内部接口
      { userAgent: "Googlebot", allow: "/", disallow },
      { userAgent: "Bingbot", allow: "/", disallow },
      { userAgent: "Baiduspider", allow: "/", disallow },
      { userAgent: "YandexBot", allow: "/", disallow },
      { userAgent: "DuckDuckBot", allow: "/", disallow },
      // AI / 生成式引擎爬虫:允许抓取公开内容用于检索与引用
      { userAgent: "GPTBot", allow: "/", disallow },
      { userAgent: "OAI-SearchBot", allow: "/", disallow },
      { userAgent: "ChatGPT-User", allow: "/", disallow },
      { userAgent: "PerplexityBot", allow: "/", disallow },
      { userAgent: "ClaudeBot", allow: "/", disallow },
      { userAgent: "anthropic-ai", allow: "/", disallow },
      { userAgent: "Google-Extended", allow: "/", disallow },
      { userAgent: "Applebot-Extended", allow: "/", disallow },
      { userAgent: "CCBot", allow: "/", disallow },
      { userAgent: "cohere-ai", allow: "/", disallow },
      { userAgent: "Bytespider", allow: "/", disallow },
      { userAgent: "Amazonbot", allow: "/", disallow },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
