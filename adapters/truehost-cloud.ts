/**
 * Truehost Cloud —— 国际站(WHMCS)域名定价, USD
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 源: https://truehost.com/cloud/index.php?rp=/domain/pricing
 * 结构: WHMCS Lagom 模板服务端渲染完整表格(561 行):
 *   TLD | Category | key(hidden) | New Price | Transfer | Renewal | Grace | Redemption
 *   TLD 单元格形如 ". com Hot!" / ". co.ke", 价格单元格形如 "New Price $8.25 1 Year"。
 * 直接 fetch 拿到完整 HTML(1.45MB/562 tr), 无需 JS 渲染。
 * 与 truehost.co.ke(KES 本地站)为不同区域站点, 独立注册商接入。
 */
import { createTableAdapter } from "./shared/table-adapter"

const URL = "https://truehost.com/cloud/index.php?rp=/domain/pricing"

/** 单元格清洗: TLD 列 ". com Hot!" -> ".com"(去空格/尾缀), 其余列保持 */
function normalizeCells(cells: string[]): string[] {
  return cells.map((c) => {
    const m = c.match(/^\.\s*([\p{L}\p{N}-]{2,20}(?:\.[\p{L}\p{N}-]{2,15}){0,2})/u)
    if (m) return `.${m[1].toLowerCase()}`
    return c
  })
}

export const truehostCloudAdapter = createTableAdapter({
  slug: "truehost-cloud",
  name: "Truehost Cloud",
  website: "https://truehost.com/cloud",
  currency: "USD",
  urls: [URL],
  // 列语义(TLD 列之后): Category | key | New Price | Transfer | Renewal | Grace | Redemption
  columnOrder: ["skip", "skip", "register", "transfer", "renew", "skip", "skip"],
  normalizeCells,
  rowFilter: (cells) => /^\./.test(cells[0]?.trim() ?? ""),
  owner: "Data Team",
})
