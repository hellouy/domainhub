/**
 * Regtons —— 静态价目表(空格千分位 + 逗号小数)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://regtons.com/en/domains
 * 表: table.price-list, 列 TLD | Info | 年限 | New | Renew | Transfer | (Order)
 * 注意: TLD 后紧跟一个"年限"选择列(值为 1/2/5/10), 必须 skip,
 *       否则会被当成注册价(历史 bug: .com 注册价被记成 1.00)。
 * 数字格式: "11,62 USD"=11.62, "1 020,00 USD"=1020.00 (fr: 空格千分位)
 * 已验证约 35+ TLD, USD/年(0,00 = 不提供 → 记 null)。
 */

import { createTableAdapter } from "./shared/table-adapter"

export const regtonsAdapter = createTableAdapter({
  slug: "regtons",
  name: "Regtons",
  website: "https://regtons.com",
  owner: "Data Team",
  currency: "USD",
  urls: ["https://regtons.com/en/domains"],
  columnOrder: ["skip", "skip", "register", "renew", "transfer"],
  numberFormat: "fr",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["USD"] },
})