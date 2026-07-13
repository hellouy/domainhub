import type { RegistrarAdapter } from "../types"
import { cloudflareAdapter } from "./cloudflare"
import { DemoAdapter } from "./demo.adapter"

/**
 * Adapter 注册表：slug -> Adapter
 *
 * 新增注册商只需两步（其余代码零改动）：
 * 1. 复制 sample.adapter.ts 为新文件，继承 BaseAdapter 实现 fetch/normalize
 * 2. 在下方 realAdapters 数组中注册一行
 *
 * 未接入真实采集的注册商由 DemoAdapter（种子数据）占位，
 * 同名 slug 的真实 Adapter 会自动覆盖 Demo 版本。
 */
const realAdapters: RegistrarAdapter[] = [cloudflareAdapter]

const demoAdapters: RegistrarAdapter[] = (
  [
    ["porkbun", "Porkbun"],
    ["namecheap", "Namecheap"],
    ["godaddy", "GoDaddy"],
    ["dynadot", "Dynadot"],
    ["namecom", "Name.com"],
    ["spaceship", "Spaceship"],
    ["aliyun", "阿里云（万网）"],
  ] as const
).map(([slug, name]) => new DemoAdapter(slug, name))

const adapters = new Map<string, RegistrarAdapter>(
  [...demoAdapters, ...realAdapters].map((a) => [a.slug, a]),
)

export function getAdapter(slug: string): RegistrarAdapter | undefined {
  return adapters.get(slug)
}

export function listAdapters(): RegistrarAdapter[] {
  return [...adapters.values()]
}
