/**
 * LLM 修复代理的输出契约(声明式适配器配置)
 * ------------------------------------------------------------
 * 所有权: Platform Team
 *
 * LLM 只输出"配置",不输出代码。配置喂给动态适配器构建器,
 * 因此 LLM 幻觉的影响面被限制在:选错列/选错 URL/选错策略 —— 而这些
 * 都会被后续的确定性验证(真实解析 + 计数 + 样本合理性)拦截。
 *
 * 多策略扩展(strategy/dataUrl/itemsPath/fieldMap/pagination/browser)
 * 全部可选:缺省即等价于"纯 HTML 表格"策略,历史 active 规则无需迁移即可继续生效。
 */

import { z } from "zod"

/** 价格列语义 */
const columnRole = z.enum(["register", "renew", "transfer", "restore", "skip"])

/** 数据源策略(动态规则可声明的子集;playwright 需部署浏览器服务) */
export const ruleStrategy = z.enum([
  "html", // 结构化 HTML 表格(默认)
  "hydration", // Next.js __NEXT_DATA__ 水合数据
  "nuxt-payload", // Nuxt __NUXT__ payload
  "embedded-json", // 页面内嵌 <script type=application/json>
  "json", // 直连 JSON 数据端点(dataUrl)
  "api", // 官方/公开 JSON API(dataUrl)
  "playwright", // 无头浏览器渲染(需 BROWSER_SERVICE_URL)
])

/** JSON 类策略下,价格项对象里各字段对应的键名 */
const fieldMapSchema = z.object({
  /** TLD 字段键名(必填),如 "tld" / "extension" / "name" */
  tld: z.string().min(1).max(60),
  /** 注册价字段键名 */
  register: z.string().max(60).optional(),
  /** 续费价字段键名 */
  renew: z.string().max(60).optional(),
  /** 转入价字段键名 */
  transfer: z.string().max(60).optional(),
  /** 赎回价字段键名 */
  restore: z.string().max(60).optional(),
})

/** 翻页配置(逐页拉取,带上限;上一页/下一页型分页站点用) */
const paginationSchema = z.object({
  /** query: 在 URL 追加 ?param=N;path: 用 {page} 占位替换 pathTemplate */
  mode: z.enum(["query", "path"]),
  /** query 模式的页码参数名,如 "page" / "p" */
  param: z.string().max(40).optional(),
  /** path 模式的 URL 模板(须含 {page}),如 https://x.com/prices/page/{page} */
  pathTemplate: z.string().url().optional(),
  /** 起始页码,默认 1 */
  start: z.number().int().min(0).max(10).optional(),
  /** 最多翻多少页(硬上限 50),默认 10 */
  maxPages: z.number().int().min(1).max(50).optional(),
})

/** playwright 策略的浏览器渲染选项(仅 strategy=playwright 或需强制渲染时) */
const browserSchema = z.object({
  /** 价格数据挂载后出现的 CSS 选择器,如 "table.pricing tbody tr" */
  waitFor: z.string().max(200).optional(),
  /** 提取前滚动到底触发懒加载,默认 true */
  scrollToBottom: z.boolean().optional(),
  /** 模拟地区 locale(影响 GeoIP 定价) */
  locale: z.string().max(10).optional(),
})

/** LLM 产出的动态适配器配置 */
export const dynamicRuleSchema = z.object({
  /** 价格数据所在页面 URL(必须来自提供的候选列表,禁止编造) */
  urls: z.array(z.string().url()).min(1).max(5),
  /** TLD 列之后各价格列的语义,按出现顺序(html 策略必用;json 策略作兜底) */
  columnOrder: z.array(columnRole).min(1).max(8),
  /** 页面数字格式 */
  numberFormat: z.enum(["en", "eu", "fr"]),
  /** 页面价格货币(ISO 4217) */
  currency: z.string().length(3),
  /** 模型对页面结构的简述(诊断用) */
  analysis: z.string().max(500),
  /** 模型自评置信度 0-1 */
  confidence: z.number().min(0).max(1),

  // —— 多策略扩展(全部可选,缺省 = 纯 HTML 表格,向后兼容旧规则)——

  /** 数据源策略;缺省按 "html" 处理 */
  strategy: ruleStrategy.optional(),
  /** json/api 策略的直连数据端点(缺省用 urls[0]) */
  dataUrl: z.string().url().optional(),
  /** JSON 中价格数组的路径,如 "props.pageProps.pricing.tlds"(缺省自动深搜) */
  itemsPath: z.string().max(200).optional(),
  /** JSON 类策略的字段映射(非 html 策略务必提供) */
  fieldMap: fieldMapSchema.optional(),
  /** 翻页配置(上一页/下一页型站点) */
  pagination: paginationSchema.optional(),
  /** 浏览器渲染选项(JS 渲染站点) */
  browser: browserSchema.optional(),
})

export type DynamicRule = z.infer<typeof dynamicRuleSchema>
export type RuleStrategy = z.infer<typeof ruleStrategy>

/** 规则验证结果(存入 adapter_rules.verification) */
export interface RuleVerification {
  parsedCount: number
  sampleTlds: string[]
  samplePrices: { tld: string; register: number | null; renew: number | null }[]
  passed: boolean
  reason?: string
  /** 实际验证所用策略(多策略扩展) */
  strategy?: string
}
