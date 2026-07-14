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
import { godaddyAdapter } from "./godaddy"
import { namecheapAdapter } from "./namecheap"
import { namecomAdapter } from "./namecom"
import { namesiloAdapter } from "./namesilo"
import { netimAdapter } from "./netim"
import { onecomAdapter } from "./onecom"
import { porkbunAdapter } from "./porkbun"
import { ovhcloudAdapter } from "./ovhcloud"
import { hostpointAdapter } from "./hostpoint"
import { spaceshipAdapter } from "./spaceship"
import {
  amenAdapter,
  arubaAdapter,
  domeneshopAdapter,
  dreamhostAdapter,
  epikAdapter,
  eurodnsAdapter,
  hoverAdapter,
  infomaniakAdapter,
  internetbsAdapter,
  loopiaAdapter,
  lwsAdapter,
  metanameAdapter,
  netcupAdapter,
  njallaAdapter,
  onamaeAdapter,
  openproviderAdapter,
  registercomAdapter,
  savAdapter,
  transipAdapter,
  truehostAdapter,
} from "./table-registrars"

export const allAdapters = [
  cloudflareAdapter,
  porkbunAdapter,
  dynadotAdapter,
  godaddyAdapter,
  namecheapAdapter,
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
  spaceshipAdapter,
  dreamhostAdapter,
  savAdapter,
  njallaAdapter,
  epikAdapter,
  truehostAdapter,
]

for (const adapter of allAdapters) {
  registerAdapter(adapter)
}

export { cloudflareAdapter, porkbunAdapter, dynadotAdapter, ovhcloudAdapter, gandiAdapter, namecomAdapter, onecomAdapter }
