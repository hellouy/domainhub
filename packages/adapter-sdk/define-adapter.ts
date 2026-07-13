/**
 * defineAdapter —— 声明式创建注册商适配器
 *
 * 所有权：Platform Team
 * 文档：docs/how-to-add-registrar.md
 *
 * 新增注册商的唯一入口。声明 slug、版本、策略列表即可获得
 * 完整的 9 阶段生命周期实现，无需重复任何基础设施代码。
 */

import { BaseAdapter } from "./base-adapter"
import type { AdapterDefinition } from "./types"

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/

/** 声明式创建适配器：校验配置并返回 BaseAdapter 实例 */
export function defineAdapter(definition: AdapterDefinition): BaseAdapter {
  if (!definition.slug || !/^[a-z0-9-]+$/.test(definition.slug)) {
    throw new Error(`适配器 slug 非法："${definition.slug}"（只允许小写字母/数字/连字符）`)
  }
  if (!definition.name) {
    throw new Error(`适配器 ${definition.slug} 缺少 name`)
  }
  if (!SEMVER_PATTERN.test(definition.version)) {
    throw new Error(`适配器 ${definition.slug} 的 version 必须为 semver（如 1.0.0）`)
  }
  if (!SEMVER_PATTERN.test(definition.parserVersion)) {
    throw new Error(`适配器 ${definition.slug} 的 parserVersion 必须为 semver（如 1.0.0）`)
  }
  if (!definition.currency || definition.currency.length !== 3) {
    throw new Error(`适配器 ${definition.slug} 的 currency 必须为 ISO 4217 三位代码`)
  }
  if (definition.strategies.length === 0) {
    throw new Error(`适配器 ${definition.slug} 至少需要声明一个数据源策略`)
  }
  return new BaseAdapter(definition)
}
