/**
 * Osir —— 静态价目表(Extension/Registration/Renewal)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://osir.com/en/pricing/
 * 表: 页面唯一 <table>, 列 Extension | Registration | Renewal
 * 价格 "$10.39/yr", USD/年。
 * 已验证 17 TLD, USD。
 */

import { createTableAdapter } from "./shared/table-adapter"

export const osirAdapter = createTableAdapter({
  slug: "osir",
  name: "Osir",
  website: "https://osir.com",
  owner: "Data Team",
  currency: "USD",
  urls: ["https://osir.com/en/pricing/"],
  columnOrder: ["register", "renew"],
  capabilities: { registration: true, renewal: true, supportedCurrencies: ["USD"] },
})