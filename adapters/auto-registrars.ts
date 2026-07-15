/**
 * 用通用自动适配器 createAutoAdapter 接入的注册商
 * ------------------------------------------------------------
 * 所有权: Platform Team
 *
 * 这些注册商无需手写解析逻辑, 仅提供价格页 URL, 由多策略发现引擎
 * (XHR-JSON → 内嵌JSON → Cheerio → LLM 兜底) 自动采集。
 */

import { createAutoAdapter } from "./shared/auto-adapter"

// INWX(德国)—— 价格由 XHR 接口 /api/v1/domain/all-prices 返回, 2000+ 后缀
// 发现引擎捕获该 XHR JSON 直接解析, 完全不依赖 DOM 或 LLM
export const inwxAdapter = createAutoAdapter({
  slug: "inwx",
  name: "INWX",
  website: "https://www.inwx.com",
  currency: "EUR",
  url: "https://www.inwx.com/en/domain/pricelist",
  useRenderer: true,
  captureUrlIncludes: ["price", "domain"],
})

// Combell(比利时)—— 渲染后 Cheerio 结构化解析
export const combellAdapter = createAutoAdapter({
  slug: "combell",
  name: "Combell",
  website: "https://www.combell.com",
  currency: "EUR",
  url: "https://www.combell.com/en/domain-names",
  useRenderer: true,
})
