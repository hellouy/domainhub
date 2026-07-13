import type { RegistrarAdapter } from "../types"
import { registrarRegistry } from "../registry"
import { cloudflareAdapter } from "./cloudflare"
import { dynadotAdapter } from "./dynadot"
import { mythicBeastsAdapter } from "./mythic-beasts"
import { ovhAdapter } from "./ovh"
import { porkbunAdapter } from "./porkbun"
import { DemoAdapter } from "./demo.adapter"

/**
 * Adapter 注册入口：所有 Adapter 在此向 RegistrarRegistry 自动注册。
 *
 * 新增注册商只需两步（其余代码零改动）：
 * 1. 复制 sample.adapter.ts 为新文件，继承 BaseAdapter 实现 fetch/normalize
 * 2. 在下方调用一次 registrarRegistry.register(newAdapter, { sourceType, ... })
 *
 * 未接入真实采集的注册商由 DemoAdapter（种子数据）占位，
 * 同名 slug 的真实 Adapter 后注册会自动覆盖 Demo 版本。
 */

// —— Demo（种子数据）占位 Adapter ——
for (const [slug, name] of [
  ["namecheap", "Namecheap"],
  ["godaddy", "GoDaddy"],
  ["namecom", "Name.com"],
  ["spaceship", "Spaceship"],
  ["aliyun", "阿里云（万网）"],
] as const) {
  registrarRegistry.register(new DemoAdapter(slug, name), {
    sourceType: "seed",
    priority: 200,
    status: "experimental",
  })
}

// —— 真实数据 Adapter（后注册覆盖同名 Demo）——
registrarRegistry.register(cloudflareAdapter, {
  sourceType: "json",
  priority: 10,
  version: "1.1.0",
  website: "https://www.cloudflare.com/products/registrar/",
})
registrarRegistry.register(porkbunAdapter, {
  sourceType: "api",
  priority: 10,
  version: "1.0.0",
  website: "https://porkbun.com",
})
registrarRegistry.register(dynadotAdapter, {
  sourceType: "html",
  priority: 20,
  version: "1.0.0",
  website: "https://www.dynadot.com",
})
registrarRegistry.register(ovhAdapter, {
  sourceType: "api",
  priority: 10,
  version: "1.0.0",
  website: "https://www.ovhcloud.com/en-ie/domains/",
})
registrarRegistry.register(mythicBeastsAdapter, {
  sourceType: "html",
  priority: 30,
  version: "1.0.0",
  website: "https://www.mythic-beasts.com/domains",
})

// —— 兼容旧接口（Runner 与既有代码依赖）——

export function getAdapter(slug: string): RegistrarAdapter | undefined {
  return registrarRegistry.get(slug)
}

export function listAdapters(): RegistrarAdapter[] {
  return registrarRegistry.list()
}
