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
  // /api/v1/domain/all-prices 默认按访问地返回 USD(发现引擎已按行读取真实币种)
  currency: "USD",
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

// ClouDNS(保加利亚)—— 渲染后整张价目表(1200+ 后缀, register+renew)以 Cheerio 结构化解析
// 价格为纯数字, 站点默认 USD 计价
export const cloudnsAdapter = createAutoAdapter({
  slug: "cloudns",
  name: "ClouDNS",
  website: "https://www.cloudns.net",
  currency: "USD",
  url: "https://www.cloudns.net/domains/",
  useRenderer: true,
  renderWaitFor: "table",
})

// NameBright(美国)—— 价格由 XHR 接口 client.namebright.com/GetAllDomainPricing 返回(400+ 后缀)
// 发现引擎捕获该 XHR JSON 直接解析, 完全不依赖 DOM 或 LLM
export const namebrightAdapter = createAutoAdapter({
  slug: "namebright",
  name: "NameBright",
  website: "https://www.namebright.com",
  currency: "USD",
  url: "https://www.namebright.com/DomainPricing",
  useRenderer: true,
  captureUrlIncludes: ["Pricing", "pricing"],
})
