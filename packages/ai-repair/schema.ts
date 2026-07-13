/**
 * LLM 修复代理的输出契约(声明式适配器配置)
 * ------------------------------------------------------------
 * 所有权: Platform Team
 *
 * LLM 只输出"配置",不输出代码。配置喂给 createTableAdapter 工厂,
 * 因此 LLM 幻觉的影响面被限制在:选错列/选错 URL —— 而这两类错误
 * 都会被后续的确定性验证(解析计数 + 校验平台)拦截。
 */

import { z } from "zod"

/** LLM 产出的表格适配器动态配置 */
export const dynamicRuleSchema = z.object({
  /** 价格数据所在页面 URL(必须来自提供的候选列表,禁止编造) */
  urls: z.array(z.string().url()).min(1).max(5),
  /** TLD 列之后各价格列的语义,按出现顺序 */
  columnOrder: z.array(z.enum(["register", "renew", "transfer", "restore", "skip"])).min(1).max(8),
  /** 页面数字格式 */
  numberFormat: z.enum(["en", "eu", "fr"]),
  /** 页面价格货币(ISO 4217) */
  currency: z.string().length(3),
  /** 模型对页面结构的简述(诊断用) */
  analysis: z.string().max(500),
  /** 模型自评置信度 0-1 */
  confidence: z.number().min(0).max(1),
})

export type DynamicRule = z.infer<typeof dynamicRuleSchema>

/** 规则验证结果(存入 adapter_rules.verification) */
export interface RuleVerification {
  parsedCount: number
  sampleTlds: string[]
  samplePrices: { tld: string; register: number | null; renew: number | null }[]
  passed: boolean
  reason?: string
}
