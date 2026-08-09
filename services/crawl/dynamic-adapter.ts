/**
 * 动态适配器构建器
 * ------------------------------------------------------------
 * 所有权: Platform Team
 *
 * 让"只有 DB 规则、没有 TypeScript 适配器文件"的注册商也能采集。
 * 当内存注册表(getRegisteredAdapter)找不到某注册商时,若该注册商
 * 存在 active 的 adapter_rules(通常由 AI 修复代理/发现流程产出),
 * 用 createTableAdapter 以规则为配置临时构建一个 BaseAdapter。
 *
 * 关键点:
 * - 该适配器不进内存注册表,仅供本次采集使用(避免污染 & 保证读到最新规则)。
 * - createTableAdapter 在 fetch 阶段还会再次按 slug 加载 active 规则,
 *   因此这里传入的 rule 仅作种子配置,运行时始终以库中最新 active 规则为准。
 */

import { createTableAdapter } from "@/adapters/shared/table-adapter"
import type { BaseAdapter } from "@/packages/adapter-sdk/base-adapter"
import type { DynamicRule } from "@/packages/ai-repair/schema"
import type { Registrar } from "@/lib/db/schema"

/** 用注册商基础信息 + active 动态规则构建一个表格适配器 */
export function buildDynamicAdapter(registrar: Registrar, rule: DynamicRule): BaseAdapter {
  return createTableAdapter({
    slug: registrar.slug,
    name: registrar.name,
    website: registrar.website,
    currency: rule.currency,
    urls: rule.urls,
    columnOrder: rule.columnOrder,
    numberFormat: rule.numberFormat,
    owner: registrar.owner ?? "AI Discovery",
    version: registrar.adapterVersion ?? "1.0.0",
    priority: registrar.priority ?? 60,
  })
}
