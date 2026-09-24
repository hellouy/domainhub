/**
 * 22.cn 适配器（贰贰互联）
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * SSR 标准价格表：`/domain/price/`，列序 域名|注册|续费|转入|赎回，
 * 覆盖约 370 个 TLD（CNY）。纯配置接入（createTableAdapter）。
 */
import { createTableAdapter } from "./shared/table-adapter"

export const cn22Adapter = createTableAdapter({
  slug: "22cn",
  name: "22.cn",
  website: "https://www.22.cn",
  currency: "CNY",
  urls: ["https://www.22.cn/domain/price/"],
  columnOrder: ["register", "renew", "transfer", "restore"],
  numberFormat: "en",
  owner: "Data Team",
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    supportedCurrencies: ["CNY"],
  },
})