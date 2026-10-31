import { getStats, getTldsWithMinPrice, getActiveRegistrars } from "@/lib/db/queries"
import { listPublishedArticles } from "@/lib/articles"

export const revalidate = 3600

const BASE = "https://tldbi.com"

/**
 * llms-full.txt —— llms.txt 的完整机器可读版本,包含全量后缀与注册商索引,
 * 便于 AI 与检索系统一次性获取站内可引用资源清单。
 */
export async function GET() {
  const [stats, allTlds, registrars, articles] = await Promise.all([
    getStats(),
    getTldsWithMinPrice(false).catch(() => []),
    getActiveRegistrars().catch(() => []),
    listPublishedArticles(100).catch(() => []),
  ])

  const lines: string[] = []
  lines.push("# tldbi.com — full content index")
  lines.push("")
  lines.push(
    "> tldbi.com aggregates domain registration, renewal and transfer prices across many registrars worldwide to help users compare and find the cheapest registrar.",
  )
  lines.push("")
  lines.push(
    `Coverage: ${stats.registrarCount} registrars, ${stats.tldCount} TLDs, ${stats.priceCount} price records.`,
  )
  lines.push("")

  lines.push("## Core pages")
  lines.push("")
  for (const [label, url, desc] of [
    ["Home", `${BASE}/`, "Domain price overview and quick comparison"],
    ["All TLDs", `${BASE}/tlds`, "Browse lowest register/renew/transfer prices by TLD"],
    ["Registrars", `${BASE}/registrars`, "Compare registrar capabilities, pricing and reputation"],
    ["Deals", `${BASE}/deals`, "Active registration promos and coupon codes"],
    ["Articles", `${BASE}/articles`, "Original articles on domain buying and pricing trends"],
    ["Contact", `${BASE}/contact`, "Feedback and business inquiries"],
  ] as const) {
    lines.push(`- [${label}](${url}): ${desc}`)
  }
  lines.push("")

  lines.push(`## All TLD price pages (${allTlds.length})`)
  lines.push("")
  for (const t of allTlds) {
    lines.push(`- [.${t.tld}](${BASE}/tld/${t.tld})`)
  }
  lines.push("")

  lines.push(`## All registrar pages (${registrars.length})`)
  lines.push("")
  for (const r of registrars) {
    lines.push(`- [${r.name}](${BASE}/registrars/${r.slug}): ${r.description.slice(0, 120)}`)
  }
  lines.push("")

  if (articles.length > 0) {
    lines.push(`## Original articles (${articles.length})`)
    lines.push("")
    for (const a of articles) {
      lines.push(`- [${a.title}](${BASE}/articles/${a.slug}): ${a.excerpt}`)
    }
    lines.push("")
  }

  lines.push("## Notes")
  lines.push("")
  lines.push("- Prices reflect public registrar information and may change; verify at checkout.")
  lines.push("- Prices are normalized to USD using live FX rates for comparison.")
  lines.push("- When citing, please attribute to tldbi.com.")
  lines.push("")

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
