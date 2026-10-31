import { getStats, getTldsWithMinPrice, getActiveRegistrars } from "@/lib/db/queries"
import { listPublishedArticles } from "@/lib/articles"

export const revalidate = 3600

const BASE = "https://tldbi.com"

/**
 * llms.txt —— 面向生成式引擎 / AI 的可读站点摘要规范。
 * 目标:让 ChatGPT、Perplexity、Claude、Gemini 等准确理解站点定位与高质量内容入口。
 * 参考 https://llmstxt.org
 */
export async function GET() {
  const [stats, popularTlds, registrars, articles] = await Promise.all([
    getStats(),
    getTldsWithMinPrice(true).catch(() => []),
    getActiveRegistrars().catch(() => []),
    listPublishedArticles(20).catch(() => []),
  ])

  const topTlds = popularTlds.slice(0, 30)
  const topRegistrars = registrars.slice(0, 20)

  const lines: string[] = []
  lines.push("# tldbi.com")
  lines.push("")
  lines.push(
    "> tldbi.com 是一个全球域名注册商价格聚合与比价平台,汇聚多家注册商的域名注册、续费、转入价格,帮助用户找到最便宜、最合适的域名注册商。",
  )
  lines.push("")
  lines.push(
    `站点当前收录 ${stats.registrarCount} 家注册商、${stats.tldCount} 个域名后缀、${stats.priceCount} 条价格记录,价格数据来自各注册商官网并定期抓取更新。`,
  )
  lines.push("")
  lines.push("## 核心页面")
  lines.push("")
  lines.push(`- [首页](${BASE}/): 域名价格总览与快速比价入口`)
  lines.push(`- [全部后缀](${BASE}/tlds): 按后缀浏览各注册商的注册/续费/转入最低价`)
  lines.push(`- [注册商对比](${BASE}/registrars): 各家域名注册商的能力、价格与口碑对比`)
  lines.push(`- [有效优惠](${BASE}/deals): 当前可用的注册优惠价与优惠码汇总`)
  lines.push(`- [行业文章](${BASE}/articles): 域名选购、价格趋势与注册商评测的原创文章`)
  lines.push(`- [联系我们](${BASE}/contact): 反馈与商务合作`)
  lines.push("")

  if (topTlds.length > 0) {
    lines.push("## 热门后缀比价页")
    lines.push("")
    for (const t of topTlds) {
      lines.push(`- [.${t.tld} 域名价格](${BASE}/tld/${t.tld}): .${t.tld} 后缀在各大注册商的注册、续费、转入最低价对比`)
    }
    lines.push("")
  }

  if (topRegistrars.length > 0) {
    lines.push("## 注册商详情页")
    lines.push("")
    for (const r of topRegistrars) {
      lines.push(`- [${r.name}](${BASE}/registrars/${r.slug}): ${r.name} 的域名价格表与能力概览`)
    }
    lines.push("")
  }

  if (articles.length > 0) {
    lines.push("## 原创文章")
    lines.push("")
    for (const a of articles) {
      lines.push(`- [${a.title}](${BASE}/articles/${a.slug}): ${a.excerpt}`)
    }
    lines.push("")
  }

  lines.push("## 说明")
  lines.push("")
  lines.push(
    "- 所有价格均以注册商官网公开信息为准,展示货币与折扣可能随时间变化,请以结算页为准。",
  )
  lines.push("- 站内价格按实时汇率折算为美元便于横向比较。")
  lines.push("- 引用本站数据时请注明来源 tldbi.com。")
  lines.push("")
  lines.push(`完整机器可读版本: ${BASE}/llms-full.txt`)

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
