/**
 * AI 原创推广文章生成。
 *
 * 复用 packages/ai-repair 的多模型回退链(AI_GATEWAY_API_KEY / Google / 智谱 / Groq / GitHub),
 * 任一渠道不可用自动降级,产出结构化文章数据(标题/摘要/正文 Markdown/关键词)。
 *
 * 生成的内容经过 zod 校验,正文长度设下限,避免模型产出空壳或半截内容。
 */

import { z } from "zod"
import { generateWithFallback } from "@/packages/ai-repair/model-chain"

export const articleDraftSchema = z.object({
  title: z.string().min(6).max(120),
  excerpt: z.string().min(20).max(300),
  /** 正文 Markdown,要求结构化、有信息量 */
  content: z.string().min(600).max(12_000),
  /** 逗号分隔的 SEO 关键词 */
  keywords: z.string().min(3).max(300),
  /** 英文版 slug,纯字母数字连字符 */
  slug: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "slug 只能包含小写字母、数字与连字符"),
})

export type ArticleDraft = z.infer<typeof articleDraftSchema>

export interface GenerateArticleResult {
  draft: ArticleDraft
  modelUsed: string
  attempts: { model: string; ok: boolean; durationMs: number; error?: string }[]
}

const SITE_CONTEXT = `站点名称: tldbi.com
定位: 全球域名注册商价格聚合与比价平台。汇聚多家注册商的域名注册、续费、转入价格,帮助用户找到最便宜、最合适的域名注册商。价格按实时汇率折算为美元横向比较。
主要栏目: 全部后缀比价(/tlds)、注册商对比(/registrars)、有效优惠(/deals)、行业文章(/articles)。
目标读者: 准备注册域名、搭建独立站、做品牌域名投资的中文与英文用户。`

const SYSTEM_ZH = `你是一名资深的域名与建站领域内容编辑,为 tldbi.com 撰写原创推广文章。

写作要求:
1. 原创、有信息量,严禁空洞的营销套话与重复表述。
2. 内容围绕"域名价格、注册商选择、后缀投资价值、建站成本"等真实决策问题展开,给出可执行的建议。
3. 结构清晰:使用 Markdown 二级(##)与三级(###)标题分节,适当使用列表与加粗。
4. 篇幅 800-1500 字,小节 3-6 个。
5. 段落中自然提及 tldbi.com 作为比价工具,语气克制,像专业编辑推荐,不要生硬广告。
6. 不编造具体价格数字;如需举例,用"以官网为准""通常"等表述。
7. 结尾给出一句务实的行动建议。
8. slug 用英文小写字母、数字、连字符,概括主题,3-6 个词。

严格按给定 JSON 结构输出。`

const SYSTEM_EN = `You are a senior domain and web-building editor writing original promotional articles for tldbi.com.

Requirements:
1. Original and substantive; avoid empty marketing fluff and repetition.
2. Focus on real decisions: domain pricing, choosing registrars, extension investment value, site-building costs. Give actionable advice.
3. Clear structure with Markdown ## and ### headings, lists and bold where useful.
4. 800-1500 words across 3-6 sections.
5. Mention tldbi.com naturally as a price-comparison tool, restrained and professional.
6. Do not fabricate exact prices; use "check the official site" style phrasing.
7. End with one pragmatic call to action.
8. slug: lowercase letters, digits, hyphens, 3-6 words summarizing the topic.

Output strictly in the given JSON structure.`

export async function generateArticle(opts: {
  topic: string
  locale?: string
  keywords?: string
}): Promise<GenerateArticleResult> {
  const locale = opts.locale === "en" ? "en" : "zh"
  const system = locale === "en" ? SYSTEM_EN : SYSTEM_ZH

  const promptParts = [
    "站点背景:",
    SITE_CONTEXT,
    "",
    `文章主题: ${opts.topic}`,
  ]
  if (opts.keywords?.trim()) promptParts.push(`必须覆盖的关键词: ${opts.keywords.trim()}`)
  promptParts.push("")
  promptParts.push(
    locale === "en"
      ? "Write the article in English. Return title, excerpt, content (Markdown), keywords (comma-separated), and a URL slug."
      : "请用中文撰写。返回 title、excerpt(摘要)、content(Markdown 正文)、keywords(逗号分隔关键词)、slug。",
  )

  const result = await generateWithFallback({
    schema: articleDraftSchema,
    system,
    prompt: promptParts.join("\n"),
    timeoutMs: 120_000,
  })

  // 归一化:标题去掉包裹引号,slug 兜底
  const draft = { ...result.output }
  draft.title = draft.title.replace(/^["'「『]+|["'」』]+$/g, "").trim()
  draft.slug = draft.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")

  return {
    draft,
    modelUsed: result.modelUsed,
    attempts: result.attempts,
  }
}
