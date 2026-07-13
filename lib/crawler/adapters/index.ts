import type { RegistrarAdapter } from "../types"
import { cloudflareAdapter } from "./cloudflare"
import { createSeedAdapter } from "./seed-adapter"

/**
 * Adapter 注册表：slug -> Adapter
 *
 * 新增注册商时：
 * 1. 在数据库 registrars 表中添加记录
 * 2. 在此目录新增独立的 Adapter 文件（如 porkbun.ts、spaceship.ts），
 *    并在下方 realAdapters 中注册；未实现真实采集的注册商自动回退到种子 Adapter
 */
const realAdapters: RegistrarAdapter[] = [cloudflareAdapter]

const seedAdapters: Record<string, RegistrarAdapter> = Object.fromEntries(
  (
    [
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

const adapters: Record<string, RegistrarAdapter> = {
  ...seedAdapters,
  ...Object.fromEntries(realAdapters.map((a) => [a.slug, a])),
}

export function getAdapter(slug: string): RegistrarAdapter | undefined {
  return adapters[slug]
}

export function listAdapters(): RegistrarAdapter[] {
  return Object.values(adapters)
}
