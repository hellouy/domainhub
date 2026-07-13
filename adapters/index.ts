/**
 * 适配器注册入口
 * ------------------------------------------------------------
 * 所有权: Data Team
 * 文档: docs/how-to-add-registrar.md
 *
 * 新增注册商三步(目标 < 30 分钟):
 * 1. 在数据库 registrars 表添加记录(slug 唯一)
 * 2. 在本目录用 defineAdapter() 新建 <slug>.ts(声明策略即可);
 *    价格页为 HTML 表格时用 createTableAdapter 纯配置接入
 * 3. 在下方 import 并加入 allAdapters 数组
 *
 * 除本目录外, 项目中任何位置都不允许出现注册商特定逻辑。
 */

import { registerAdapter } from "@/packages/registry"
import { cloudflareAdapter } from "./cloudflare"
import { dynadotAdapter } from "./dynadot"
import { gandiAdapter } from "./gandi"
import { namecomAdapter } from "./namecom"
import { onecomAdapter } from "./onecom"
import { porkbunAdapter } from "./porkbun"
import { ovhcloudAdapter } from "./ovhcloud"
import {
  amenAdapter,
  arubaAdapter,
  domeneshopAdapter,
  eurodnsAdapter,
  hostpointAdapter,
  hoverAdapter,
  infomaniakAdapter,
  internetbsAdapter,
  loopiaAdapter,
  lwsAdapter,
  metanameAdapter,
  namesiloAdapter,
  netcupAdapter,
  netimAdapter,
  onamaeAdapter,
  openproviderAdapter,
  registercomAdapter,
  transipAdapter,
} from "./table-registrars"

export const allAdapters = [
  cloudflareAdapter,
  porkbunAdapter,
  dynadotAdapter,
  ovhcloudAdapter,
  gandiAdapter,
  namecomAdapter,
  onecomAdapter,
  namesiloAdapter,
  hoverAdapter,
  onamaeAdapter,
  internetbsAdapter,
  netimAdapter,
  eurodnsAdapter,
  registercomAdapter,
  metanameAdapter,
  infomaniakAdapter,
  loopiaAdapter,
  domeneshopAdapter,
  hostpointAdapter,
  netcupAdapter,
  lwsAdapter,
  amenAdapter,
  arubaAdapter,
  transipAdapter,
  openproviderAdapter,
]

for (const adapter of allAdapters) {
  registerAdapter(adapter)
}

export { cloudflareAdapter, porkbunAdapter, dynadotAdapter, ovhcloudAdapter, gandiAdapter, namecomAdapter, onecomAdapter }
