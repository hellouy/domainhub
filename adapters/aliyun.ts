/**
 * 阿里云·万网（wanwang.aliyun.com）—— 中国最大注册商价目(CNY)
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://wanwang.aliyun.com/help/price.html（低代码页, 价格由运行时渲染）
 * 直连仅得空壳 → anti-bot 策略走聚合服务渲染后解析。
 *
 * 渲染后 ACE 表格为合并表头, 数据行 12 列:
 *   TLD | 注册1年 | 注册3年 | 注册5年 | 注册10年
 *      | 续费1年 | 续费3年 | 续费5年 | 续费10年
 *      | 转入 | 赎回 | 操作
 * 注册1年可含促销双值("52元150元" = 促销52/原价150, dualValue 提取)。
 * 页面另有多年付简表(4列)与增值服务表, rowFilter 按列数过滤。
 */
import { createTableAdapter, defaultNormalize } from "./shared/table-adapter"

export const aliyunAdapter = createTableAdapter({
  slug: "aliyun",
  name: "阿里云(万网) Aliyun",
  website: "https://wanwang.aliyun.com",
  currency: "CNY",
  urls: ["https://wanwang.aliyun.com/help/price.html"],
  columnOrder: [
    "register",
    "skip", "skip", "skip",
    "renew",
    "skip", "skip", "skip",
    "transfer",
    "restore",
    "skip",
  ],
  dualValuePromoColumns: ["register"],
  rowFilter: (cells) => cells.length >= 11,
  // 促销双值单元格为"促销价 原价"顺序(.price-wrap-new 在前, 划线原价在后),
  // 与 parseDualPrice 的"原价 促销价"假设相反 → 反转使原价落 register、促销价落 promotionPrice
  normalizeCells: (cells) =>
    defaultNormalize(cells).map((c) => {
      const m = c.match(/^(\d+(?:\.\d+)?)元\s+(\d+(?:\.\d+)?)元$/)
      if (m && parseFloat(m[1]) < parseFloat(m[2])) return `${m[2]}元 ${m[1]}元`
      return c
    }),
  antiBot: { keyword: "立即注册" },
  rpm: 6,
  owner: "Data Team",
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    supportedCurrencies: ["CNY"],
  },
})
