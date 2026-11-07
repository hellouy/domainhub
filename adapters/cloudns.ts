/**
 * ClouDNS 适配器
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源结论(2026-11-07 实测):
 * 1. 价目页 /domain-pricing-list/ 的表格由 AJAX 注入，直接 POST 站点内部端点取完整价表：
 *    POST /ajaxPages.php?action=domain-pricing-list&nocache=<ts>，body "&show=table&category="
 *    （category 空 = 全部 1249 个 TLD），响应为完整 <table> 片段（约 880KB，1.8s）。
 * 2. 无需 cookie/会话：无 cookie 冷 POST 实测返回相同 1249 行，纯 fetch 可采，
 *    零浏览器依赖（原 playwright + browser-worker 方案已废弃）。
 * 3. 行结构 tr.tlds 6 列：TLD / Registration / Transfer / Renewal / Privacy / DNSSEC。
 * 4. 促销（共 321 行）：单元格形如 <span class="old">$标准价</span> $现价，
 *    register 列 227 行、transfer 列 93 行、renew 列 7 行。
 *    映射：registerPrice/renewPrice/transferPrice 取标准价（old 存在取 old，否则取现价），
 *    promotionPrice 仅当 register 列有促销且现价 < 标准价时取现价
 *    （平台校验要求促销价低于标准注册价，否则清空）。
 * 5. 对齐历史：旧 browser-worker 脚本对促销行 textContent 数字粘连（如 "15.59 11.49"）
 *    实际取到第一个数即标准价，DB 现存数据均为标准价、promotion 为空；本实现显式分离两价。
 */

import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

const PAGE_URL = "https://www.cloudns.net/domain-pricing-list/"
const AJAX_URL = "https://www.cloudns.net/ajaxPages.php"

const num = (s: string | undefined): number | null => {
  if (!s) return null
  const v = Number.parseFloat(s.replace(/,/g, ""))
  return Number.isFinite(v) && v > 0 && v < 1000000 ? Math.round(v * 100) / 100 : null
}

interface CellPrices {
  standard: number | null
  current: number | null
}

function parseCell(td: string): CellPrices {
  const oldM = td.match(/class="old">\s*\$?\s*([\d.,]+)/)
  const withoutOld = td.replace(/<span class="old">[\s\S]*?<\/span>/, " ")
  const curM = withoutOld.match(/\$([\d.,]+)/)
  return { standard: num(oldM?.[1]), current: num(curM?.[1]) }
}

async function fetchCloudns(ctx: AdapterContext): Promise<string> {
  const res = await ctx.fetch(`${AJAX_URL}?action=domain-pricing-list&nocache=${Date.now()}`, {
    method: "POST",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Referer: PAGE_URL,
    },
    body: "&show=table&category=",
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`cloudns AJAX 返回 HTTP ${res.status}`)
  return res.text()
}

function parseCloudns(raw: string): RawPrice[] {
  const prices: RawPrice[] = []
  const seen = new Set<string>()
  const rowRe = /<tr[^>]*\btlds\b[^>]*>([\s\S]*?)<\/tr>/g
  let m: RegExpExecArray | null
  while ((m = rowRe.exec(raw)) !== null) {
    const tds = m[1].split(/<td[^>]*>/).slice(1)
    if (tds.length < 4) continue
    // TLD 单元格两种形态：<a href="/domains/tld/com/">.com</a> 或纯文本 .cz（982 行无链接）
    const tld = tds[0]
      .replace(/<[^>]+>/g, "")
      .trim()
      .replace(/^\./, "")
      .toLowerCase()
    if (!tld || !/^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(tld) || seen.has(tld)) continue
    const reg = parseCell(tds[1])
    const tra = parseCell(tds[2])
    const rn = parseCell(tds[3])
    const registerPrice = reg.standard ?? reg.current
    const renewPrice = rn.standard ?? rn.current
    const transferPrice = tra.standard ?? tra.current
    const promotionPrice =
      reg.standard != null && reg.current != null && reg.current < reg.standard ? reg.current : null
    if (registerPrice == null && renewPrice == null && transferPrice == null) continue
    seen.add(tld)
    prices.push({
      tld,
      currency: "USD",
      registerPrice,
      renewPrice,
      transferPrice,
      promotionPrice,
      promotion: promotionPrice != null,
      billingPeriod: "1y",
      sourceUrl: PAGE_URL,
    })
  }
  if (prices.length === 0) throw new Error("cloudns 价表片段解析结果为空(页面结构可能已变化)")
  return prices
}

export const cloudnsAdapter = defineAdapter({
  slug: "cloudns",
  name: "ClouDNS",
  website: "https://www.cloudns.net",
  version: "3.0.0",
  parserVersion: "3.0.0",
  owner: "Data Team",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["USD"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 2, timeoutMs: 30_000 },
  strategies: [
    {
      type: "xhr",
      url: `${AJAX_URL}?action=domain-pricing-list`,
      fetch: fetchCloudns,
      parse: parseCloudns,
    },
  ],
})
