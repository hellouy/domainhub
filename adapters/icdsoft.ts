/**
 * ICDsoft —— 静态价目表(独立注册价)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://icdsoft.com/en/domains
 * 表: table.nicd-comparison-table, 列
 *   TLD | Purchase/Renewal with hosting | Standalone registration/Renewal | WHOIS | DNS
 * 取独立注册价(col2)为 register; col1/col3/col4 跳过。
 * 已验证约 30 TLD, USD/年, 无转入价。
 */

import { createTableAdapter } from "./shared/table-adapter"

export const icdsoftAdapter = createTableAdapter({
  slug: "icdsoft",
  name: "ICDSoft",
  website: "https://icdsoft.com",
  owner: "Data Team",
  currency: "USD",
  urls: ["https://icdsoft.com/en/domains"],
  columnOrder: ["skip", "register", "skip", "skip"],
  capabilities: { registration: true, supportedCurrencies: ["USD"] },
})