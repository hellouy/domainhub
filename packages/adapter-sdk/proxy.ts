/**
 * Proxy Platform —— 供应商无关的代理抽象（仅架构层）
 *
 * 所有权：Platform Team
 * 文档：docs/adapter-sdk.md（Proxy 章节）
 *
 * 当前 Vercel 运行时不支持自定义出口代理，此模块仅提供
 * 统一的类型与解析入口。未来接入代理供应商时，只需实现
 * resolveProxyAgent 而不需要改动任何适配器。
 */

import type { ProxyConfig } from "./types"

export const NO_PROXY: ProxyConfig = { type: "none" }

/**
 * 将 ProxyConfig 解析为 fetch 可用的 dispatcher/agent。
 * 目前返回 undefined（直连）；接入 undici ProxyAgent / SOCKS
 * 供应商时在此处扩展，适配器无感知。
 */
export function resolveProxyAgent(config: ProxyConfig | undefined): undefined {
  if (!config || config.type === "none") return undefined
  // 架构预留：http/https/socks5/residential/datacenter/rotating
  // 在支持自定义 dispatcher 的运行时（Node.js self-hosted / 容器）中，
  // 此处返回对应的 ProxyAgent 实例。
  return undefined
}

/** 校验代理配置的完整性 */
export function validateProxyConfig(config: ProxyConfig): string | null {
  if (config.type === "none") return null
  if (!config.url) return `代理类型 ${config.type} 需要提供 url`
  return null
}
