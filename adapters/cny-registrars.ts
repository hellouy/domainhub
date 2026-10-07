/**
 * 中文注册商三件套(CNY, 价格表 JS 渲染)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * - julyname: https://julyname.com/price.htm 618 行,
 *   [TLD+促銷, 首年价, 续费价, 转入价, 描述, 按钮]
 * - 59.cn: https://ym.longming.com/pricing 321 行,
 *   [TLD+热, 介绍, 首年价, 续费价, 转入价, 按钮]
 * - zw.cn: https://zw.cn/Domain/domainprice.html 42 行,
 *   [TLD, 注册价, 续费价, 转入价, 赎回联系]
 */
import { createRenderedTableAdapter } from "@/adapters/shared/render-table-adapter"

const dotStart = (cells: string[]) => /^\.[a-z]/i.test((cells[0] ?? "").trim())

export const julynameAdapter = createRenderedTableAdapter({
  slug: "julyname",
  name: "JulyName",
  website: "https://julyname.com",
  currency: "CNY",
  url: "https://julyname.com/price.htm",
  columnOrder: ["register", "renew", "transfer", "skip", "skip"],
  rowFilter: dotStart,
  firstYearIsPromo: true,
  owner: "Data Team",
})

export const cny59Adapter = createRenderedTableAdapter({
  slug: "59cn",
  name: "59.cn",
  website: "https://www.59.cn",
  currency: "CNY",
  url: "https://ym.longming.com/pricing",
  columnOrder: ["skip", "register", "renew", "transfer", "skip"],
  rowFilter: dotStart,
  firstYearIsPromo: true,
  owner: "Data Team",
})

export const zwcnAdapter = createRenderedTableAdapter({
  slug: "zwcn",
  name: "Zw.cn",
  website: "https://zw.cn",
  currency: "CNY",
  url: "https://zw.cn/Domain/domainprice.html",
  columnOrder: ["register", "renew", "transfer", "skip"],
  rowFilter: dotStart,
  owner: "Data Team",
})
