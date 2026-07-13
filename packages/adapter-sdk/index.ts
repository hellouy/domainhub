/**
 * @domainhub/adapter-sdk —— Adapter SDK 2.0 公共入口
 *
 * 所有权：Platform Team
 * 文档：docs/adapter-sdk.md
 */

export * from "./types"
export { BaseAdapter, type PriceSink, type AdapterTestReport } from "./base-adapter"
export { defineAdapter } from "./define-adapter"
export { executeStrategies, type StrategyExecution } from "./strategy-engine"
export { validatePrices, type ExistingPriceLookup } from "./validation"
export { rateLimitedFetch, resetLimiter, CircuitOpenError } from "./rate-limit"
export { resolveProxyAgent, validateProxyConfig, NO_PROXY } from "./proxy"
