/**
 * 适配器注册入口
 * ------------------------------------------------------------
 * 所有权: Data Team
 * 文档: docs/how-to-add-registrar.md
 *
 * 新增注册商三步(目标 < 30 分钟):
 * 1. 在数据库 registrars 表添加记录(slug 唯一)
 * 2. 在本目录用 defineAdapter() 新建 <slug>.ts(声明策略即可)
 * 3. 在下方 import 并加入 allAdapters 数组
 *
 * 除本目录外, 项目中任何位置都不允许出现注册商特定逻辑。
 */

import { registerAdapter } from "@/packages/registry"
import { cloudflareAdapter } from "./cloudflare"
import { dynadotAdapter } from "./dynadot"
import { porkbunAdapter } from "./porkbun"

export const allAdapters = [cloudflareAdapter, porkbunAdapter, dynadotAdapter]

for (const adapter of allAdapters) {
  registerAdapter(adapter)
}

export { cloudflareAdapter, porkbunAdapter, dynadotAdapter }
