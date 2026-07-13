import "server-only"

import type { DomainPrice } from "@/lib/crawler/types"

/**
 * Validator 服务：价格写入前的最后一道防线
 *
 * 规则（任一不满足即拒绝该记录，绝不带病入库）：
 * 1. register_price 缺失          —— 注册价是比价平台的核心字段
 * 2. 任何价格 <= 0                —— 非法数值
 * 3. currency 缺失或非 ISO 4217   —— 币种必须有效
 * 4. tld 格式非法                 —— 仅允许 a-z0-9- 与多级后缀（如 co.uk）
 * 5. 同一批次内 tld 重复          —— 后出现者被拒绝
 *
 * 拒绝的记录写入 crawl_logs（warn），任务标记为 warning，
 * 已有价格不会被无效数据覆盖。
 */

const TLD_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/
const CURRENCY_PATTERN = /^[A-Z]{3}$/

export interface RejectedRecord {
  record: DomainPrice
  reason: string
}

export interface ValidationResult {
  valid: DomainPrice[]
  rejected: RejectedRecord[]
}

export class ValidatorService {
  validate(items: DomainPrice[]): ValidationResult {
    const valid: DomainPrice[] = []
    const rejected: RejectedRecord[] = []
    const seenTlds = new Set<string>()

    for (const item of items) {
      const reason = this.check(item, seenTlds)
      if (reason) {
        rejected.push({ record: item, reason })
        continue
      }
      seenTlds.add(item.tld)
      valid.push(item)
    }

    return { valid, rejected }
  }

  private check(item: DomainPrice, seenTlds: Set<string>): string | null {
    if (!item.tld || !TLD_PATTERN.test(item.tld)) {
      return `后缀格式非法："${item.tld}"`
    }
    if (seenTlds.has(item.tld)) {
      return `后缀重复：.${item.tld}`
    }
    if (item.register_price === null || item.register_price === undefined) {
      return `.${item.tld} 缺少注册价格`
    }
    for (const [label, value] of [
      ["注册", item.register_price],
      ["续费", item.renew_price],
      ["转入", item.transfer_price],
    ] as const) {
      if (value !== null && (!Number.isFinite(value) || value <= 0)) {
        return `.${item.tld} ${label}价格非法：${value}`
      }
    }
    if (!item.currency || !CURRENCY_PATTERN.test(item.currency)) {
      return `.${item.tld} 币种缺失或非法："${item.currency}"`
    }
    return null
  }
}

/** 默认单例（Runner 通过构造函数注入，可替换为测试替身） */
export const validatorService = new ValidatorService()
