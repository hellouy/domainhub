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
import { netimAdapter } from "./netim"
import { metanameAdapter } from "./metaname"
import { onecomAdapter } from "./onecom"
import { porkbunAdapter } from "./porkbun"
import { ovhcloudAdapter } from "./ovhcloud"
import { hostpointAdapter } from "./hostpoint"
import { arubaAdapter } from "./aruba"
import {
  amenAdapter,
  domeneshopAdapter,
  eurodnsAdapter,
  hoverAdapter,
internetbsAdapter,
  loopiaAdapter,
  lwsAdapter,
  netcupAdapter,
  onamaeAdapter,
  registercomAdapter,
  transipAdapter,
  xserverAdapter,
  valueDomainAdapter,
  muumuuDomainAdapter,
  directnicAdapter,
  dreamhostAdapter,
  jumingAdapter,
  blacknightAdapter,
  namesiloAdapter,
  exabytesAdapter,
  networksolutionsAdapter,
  truehostAdapter,
  hostingkrAdapter,
  cndnsAdapter,
  lcnAdapter,
  fabulousAdapter,
  danescoAdapter,
  barberoAdapter,
} from "./table-registrars"
import { pskzAdapter } from "./pskz"
import { julynameAdapter, cny59Adapter, zwcnAdapter } from "./cny-registrars"
import { forpsiAdapter } from "./forpsi"
import { hostingerAdapter } from "./hostinger"
import { cloudnsAdapter } from "./cloudns"
import { domain101Adapter } from "./101domain"
import { cn22Adapter } from "./22cn"
import { westcnAdapter } from "./westcn"
import { openproviderAdapter } from "./openprovider"
import { krystalAdapter } from "./krystal"
import { inwxAdapter } from "./inwx"
import { ukrnamesAdapter, idwebhostAdapter, keliwebAdapter } from "./breadth-scan"
import { enomAdapter } from "./enom"
import { infomaniakAdapter } from "./infomaniak"
import { resellerclubAdapter } from "./resellerclub"
import { tierraAdapter } from "./tierra"
import { connectresellerAdapter } from "./connectreseller"
import { jokerAdapter } from "./joker"
import { nicnamesAdapter } from "./nicnames"
import { epikAdapter } from "./epik"
import { oneAdapter } from "./one"
import { interserverAdapter } from "./interserver"
import { register4lessAdapter } from "./register4less"
import { rebelAdapter } from "./rebel"
import { domaincostclubAdapter } from "./domaincostclub"
import { regtonsAdapter } from "./regtons"
import { osirAdapter } from "./osir"
import { imenaAdapter } from "./imena"
import { icdsoftAdapter } from "./icdsoft"
import { istancoAdapter } from "./istanco"
import { mchostAdapter } from "./mchost"
import { hostafricaAdapter } from "./hostafrica"
import { ultahostAdapter } from "./ultahost"
import { iwantmynameAdapter } from "./iwantmyname"
import { gnameAdapter } from "./gname"
import { wpxAdapter } from "./wpx"
import { whcAdapter } from "./whc"
import { easyspaceAdapter } from "./easyspace"
import { onlydomainsAdapter } from "./onlydomains"
import { dotweeAdapter } from "./dotwee"
import { dotologyAdapter } from "./dotology"
import { activeDomainsAdapter } from "./activedomains"
import { atakdomainAdapter } from "./atakdomain"
import { starDomainAdapter } from "./stardomain"
import { gatehillsAdapter } from "./gatehills"
import { netzoneAdapter } from "./netzone"
import { gzidcAdapter } from "./gzidc"
import { namegearAdapter } from "./namegear"
import { cciregAdapter } from "./ccireg"
import { koumingAdapter } from "./kouming"
import { vsysAdapter } from "./vsys"
import { alldomainsUzAdapter } from "./alldomains-uz"
import { rumahwebAdapter } from "./rumahweb"
import { cosmotownAdapter } from "./cosmotown"
import { cpiAdapter } from "./cpi"
import { active24Adapter } from "./active24"
import { spaceshipAdapter } from "./spaceship"

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
  loopiaAdapter,
  domeneshopAdapter,
  hostpointAdapter,
  netcupAdapter,
  lwsAdapter,
  amenAdapter,
  arubaAdapter,
  transipAdapter,
  xserverAdapter,
  valueDomainAdapter,
  muumuuDomainAdapter,
  hostingerAdapter,
  cloudnsAdapter,
  domain101Adapter,
  cn22Adapter,
  westcnAdapter,
  openproviderAdapter,
  krystalAdapter,
  directnicAdapter,
  dreamhostAdapter,
  jumingAdapter,
  blacknightAdapter,
  namesiloAdapter,
  exabytesAdapter,
  networksolutionsAdapter,
  truehostAdapter,
  hostingkrAdapter,
  inwxAdapter,
  ukrnamesAdapter,
  idwebhostAdapter,
  keliwebAdapter,
  // 需 API 凭证的注册商（后台配好 Key 后自动生效采集；无 Key 时不产数据）
  enomAdapter,
  infomaniakAdapter,
  resellerclubAdapter,
  // tldhub 索引探测命中：干净可接入（2026-09-29）
  tierraAdapter,
  connectresellerAdapter,
  jokerAdapter,
  nicnamesAdapter,
  epikAdapter,
  oneAdapter,
  interserverAdapter,
  register4lessAdapter,
  rebelAdapter,
  domaincostclubAdapter,
  regtonsAdapter,
  osirAdapter,
  imenaAdapter,
  icdsoftAdapter,
  istancoAdapter,
  mchostAdapter,
  hostafricaAdapter,
  ultahostAdapter,
  // 第二批探索新增：更广覆盖与多币种（2026-10-02）
  iwantmynameAdapter,
  gnameAdapter,
  wpxAdapter,
  whcAdapter,
  easyspaceAdapter,
  onlydomainsAdapter,
  // 第三批：ICANN 全局索引探测命中（2026-10-03）
  dotweeAdapter,
  dotologyAdapter,
  // 扩量+多币种: 俄语注册商 Active.domains (RUB)
  activeDomainsAdapter,
  // 第四批: ICANN 候选深探命中 (2026-10-04)
  atakdomainAdapter,
  starDomainAdapter,
  gatehillsAdapter,
  // 第五批: ICANN 存活候选首页链接深挖命中 (2026-10-04)
  netzoneAdapter,
  gzidcAdapter,
  namegearAdapter,
  cciregAdapter,
  koumingAdapter,
  vsysAdapter,
  alldomainsUzAdapter,
  rumahwebAdapter,
  cosmotownAdapter,
  // 第六批: 修复失效 URL + 新增 CNDNS(2026-10-07)
  cndnsAdapter,
  // 第七批: 类别分组价表新增 CPI(JPY, 2026-10-07)
  cpiAdapter,
  // 第八批: 新增 Active24(CZK) 与 LCN(GBP)(2026-10-07)
  active24Adapter,
  lcnAdapter,
  // 第九批: 候选池全量扫命中 fabulous/danesco/barbero + 修复 lws(2026-10-07)
  fabulousAdapter,
  danescoAdapter,
  barberoAdapter,
  // 第十批: PS.kz(KZT, 哈萨克坚戈, 浏览器渲染)(2026-10-07)
  pskzAdapter,
  // 第十一批: 中文注册商三件套 julyname/59.cn/zw.cn(CNY, 浏览器渲染)(2026-10-07)
  julynameAdapter,
  cny59Adapter,
  zwcnAdapter,
  // 第十二批: forpsi(CZK, 捷克, SSR 表格直连 + akce 促销列)(2026-10-07)
  forpsiAdapter,
  // 第十三批: Spaceship(USD, 定价 BFF API 批量重放)(2026-10-08)
  spaceshipAdapter,
]

for (const adapter of allAdapters) {
  registerAdapter(adapter)
}

export { cloudflareAdapter, porkbunAdapter, dynadotAdapter, ovhcloudAdapter, gandiAdapter, namecomAdapter, onecomAdapter }
