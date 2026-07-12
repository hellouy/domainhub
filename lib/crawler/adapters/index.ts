import type { RegistrarAdapter } from "../types"
import { createSeedAdapter } from "./seed-adapter"

/**
 * Adapter 注册表：slug -> Adapter
 *
 * 新增注册商时：
 * 1. 在数据库 registrars 表中添加记录
 * 2. 在此注册对应的 Adapter（种子 Adapter 或自定义真实采集 Adapter）
 */
const adapters: Record<string, RegistrarAdapter> = Object.fromEntries(
  (
    [
      ["cloudflare", "Cloudflare"],
      ["porkbun", "Porkbun"],
      ["namecheap", "Namecheap"],
      ["godaddy", "GoDaddy"],
      ["dynadot", "Dynadot"],
      ["namecom", "Name.com"],
      ["spaceship", "Spaceship"],
      ["aliyun", "阿里云（万网）"],
    ] as const
  ).map(([slug, name]) => [slug, createSeedAdapter(slug, name)]),
)

export function getAdapter(slug: string): RegistrarAdapter | undefined {
  return adapters[slug]
}

export function listAdapters(): RegistrarAdapter[] {
  return Object.values(adapters)
}
