/**
 * Regtons —— 静态价目表(空格千分位 + 逗号小数)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://regtons.com/en/domains
 * 表: table.price-list, 列 TLD | Info | New | Renew | Transfer | (Order)
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
  columnOrder: ["skip", "register", "renew", "transfer", "skip"],
  numberFormat: "fr",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["USD"] },
})