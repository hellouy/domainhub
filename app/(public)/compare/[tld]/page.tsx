import { permanentRedirect } from "next/navigation"

/**
 * /compare/[tld] 与 /tld/[tld] 内容重复（同一价格表），
 * 为减少点击层级已合并到 /tld/[tld]，此路由永久重定向以保留旧链接与 SEO。
 */
export default async function ComparePage({ params }: { params: Promise<{ tld: string }> }) {
  const { tld } = await params
  permanentRedirect(`/tld/${encodeURIComponent(decodeURIComponent(tld))}`)
}
