/**
 * Validation Platform —— 标准化价格的统一校验
 *
 * 所有权：Platform Team
 * 文档：docs/adapter-sdk.md（Validation 章节）
 *
 * 校验规则：负价格、币种不一致、缺失续费价、重复行、离群值、价格突变。
 * 结果三态：valid / warning / rejected。
 * rejected 的行不会入库；warning 的行入库但记录问题。
 */

import type {
  NormalizedPrice,
  ValidatedPrice,
  ValidationIssue,
} from "./types"

/** 现有价格查询（用于价格突变检测），由调用方注入避免循环依赖 */
export type ExistingPriceLookup = (
  tld: string,
) => { registerPrice: number | null; renewPrice: number | null } | undefined

/** 单价超过该倍数中位数视为离群（警告） */
const OUTLIER_MULTIPLIER = 50
/** 相对旧价变化超过该比例视为突变（警告） */
const LARGE_CHANGE_RATIO = 0.5

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * 校验一批标准化价格。
 * expectedCurrency：适配器声明的币种；lookupExisting：查询旧价格用于突变检测。
 */
export function validatePrices(
  prices: NormalizedPrice[],
  expectedCurrency: string,
  lookupExisting?: ExistingPriceLookup,
): ValidatedPrice[] {
  const seen = new Set<string>()
  const registerValues = prices
    .map((p) => p.registerPrice)
    .filter((v): v is number => typeof v === "number" && v > 0)
  const med = median(registerValues)

  return prices.map((price) => {
    const issues: ValidationIssue[] = []
    let status: "valid" | "warning" | "rejected" = "valid"

    const reject = (code: string, message: string) => {
      issues.push({ code, message })
      status = "rejected"
    }
    const warn = (code: string, message: string) => {
      issues.push({ code, message })
      if (status === "valid") status = "warning"
    }

    // 1. 负价格 → 拒绝；零价/近零价（<= 0.5）视为占位数据 → 置空
    for (const [field, v] of [
      ["registerPrice", price.registerPrice],
      ["renewPrice", price.renewPrice],
      ["transferPrice", price.transferPrice],
      ["restorePrice", price.restorePrice],
    ] as const) {
      if (typeof v === "number" && v < 0) {
        reject("negative-price", `${field} 为负数：${v}`)
      } else if (typeof v === "number" && v <= 0.5) {
        // 0 或近 0 通常是"价格未公布"的占位符,不是真实报价
        warn("zero-price", `${field} 为 ${v}，视为未公布并置空`)
        ;(price as unknown as Record<string, unknown>)[field] = null
      }
    }

    // 2. 全部价格为空 → 拒绝
    if (
      price.registerPrice === null &&
      price.renewPrice === null &&
      price.transferPrice === null
    ) {
      reject("empty-row", "注册/续费/转入价格全部缺失")
    }

    // 3. 币种不一致 → 拒绝
    if (price.currency !== expectedCurrency) {
      reject(
        "currency-mismatch",
        `币种 ${price.currency} 与适配器声明的 ${expectedCurrency} 不一致`,
      )
    }

    // 4. 重复行 → 拒绝（保留首行）
    const key = `${price.tld}|${price.region ?? ""}`
    if (seen.has(key)) {
      reject("duplicate", `重复的后缀行：${price.tld}`)
    } else {
      seen.add(key)
    }

    // 5. 缺失续费价 → 警告
    if (price.registerPrice !== null && price.renewPrice === null) {
      warn("missing-renewal", "有注册价但缺失续费价")
    }

    // 6. 离群值 → 警告（注册价超过中位数 50 倍，且非 premium）
    if (
      med !== null &&
      med > 0 &&
      typeof price.registerPrice === "number" &&
      price.registerPrice > med * OUTLIER_MULTIPLIER &&
      !price.premium
    ) {
      warn(
        "outlier",
        `注册价 ${price.registerPrice} 超过中位数 ${med.toFixed(2)} 的 ${OUTLIER_MULTIPLIER} 倍`,
      )
    }

    // 7. 价格突变 → 警告（相对旧价变化超过 50%）
    const prev = lookupExisting?.(price.tld)
    if (prev?.registerPrice && typeof price.registerPrice === "number" && prev.registerPrice > 0) {
      const ratio = Math.abs(price.registerPrice - prev.registerPrice) / prev.registerPrice
      if (ratio > LARGE_CHANGE_RATIO) {
        warn(
          "large-change",
          `注册价从 ${prev.registerPrice} 变为 ${price.registerPrice}（变化 ${(ratio * 100).toFixed(0)}%）`,
        )
      }
    }

    return { price, status, issues }
  })
}
