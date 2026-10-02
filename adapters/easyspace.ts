/**
 * Easyspace —— 静态价目表(GBP)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.easyspace.com/pricelist
 * 表列: Extension | Term | Price | *Renewal
 * 价格单元格含 data-gbp 属性 + £ 文本。
 * 已验证约 526+ TLD, GBP/年。
 */

import { createTableAdapter } from "./shared/table-adapter"

export const easyspaceAdapter = createTableAdapter({
  slug: "easyspace",
  name: "Easyspace",
  website: "https://www.easyspace.com",
  owner: "Data Team",
  currency: "GBP",
  urls: ["https://www.easyspace.com/pricelist"],
  // Extension | Term | Price | Renewal → term(skip), register, renew
  columnOrder: ["skip", "register", "renew"],
  capabilities: { registration: true, renewal: true, supportedCurrencies: ["GBP"] },
})