/**
 * Easyspace —— 静态价目表(GBP)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.easyspace.com/pricelist
 * 页面含多个表格, 仅 "Domain Name Extensions" 表有效:
 *   列: Extension | Term | Notification | Price | *Renewal
 *   term/notification 跳过, Price=注册价, *Renewal=续费价。
 * 其余表(Transfer Costs / 主机产品等)列结构不同, 用 rowFilter 排除。
 * 已验证约 540 TLD, GBP/年。
 */

import { createTableAdapter } from "./shared/table-adapter"

export const easyspaceAdapter = createTableAdapter({
  slug: "easyspace",
  name: "Easyspace",
  website: "https://www.easyspace.com",
  owner: "Data Team",
  currency: "GBP",
  urls: ["https://www.easyspace.com/pricelist"],
  // Extension | Term | Notification | Price | *Renewal → term(skip), notif(skip), register, renew
  columnOrder: ["skip", "skip", "register", "renew"],
  // 仅解析 5 列的 "Domain Name Extensions" 表, 排除 Transfer Costs(3列)/产品表(3列)
  rowFilter: (cells) => cells.length >= 5,
  capabilities: { registration: true, renewal: true, supportedCurrencies: ["GBP"] },
})