/**
 * 域域（quyu.net）—— 中国注册商价目(CNY)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://www.quyu.net/domainpricelist.php (SSR 标准表格)
 * 954 行, 列序: 域名后缀 | 最少年限 | 注册 | 转入 | 续费 | 赎回 | 溢价说明。
 * 覆盖 172 个 2 字母 ccTLD + 11 个中文 IDN 后缀(.中国/.在线/.世界 等)。
 * 价格带"元"后缀("79.00元"), parsePrice 清洗后按 en 格式解析。
 * 纯配置接入(createTableAdapter)。
 */
import { createTableAdapter } from "./shared/table-adapter"

export const quyuAdapter = createTableAdapter({
  slug: "quyu",
  name: "域域 QuYu",
  website: "https://www.quyu.net",
  currency: "CNY",
  urls: ["https://www.quyu.net/domainpricelist.php"],
  // TLD 后: 最少年限 | 注册 | 转入 | 续费 | 赎回 | 溢价说明
  columnOrder: ["skip", "register", "transfer", "renew", "restore"],
  numberFormat: "en",
  rpm: 10,
  owner: "Data Team",
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    supportedCurrencies: ["CNY"],
  },
})
