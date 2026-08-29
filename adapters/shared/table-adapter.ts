/**
 * 配置驱动的 HTML 表格适配器工厂
 * ------------------------------------------------------------
 * 所有权: Platform Team
 *
 * 大量注册商的价格页是结构化 HTML 表格。该工厂把"新增注册商"
 * 降为纯配置: URL + 货币 + 列语义, 无需新基础设施。
 *
 * 自动能力:
 * - 多页抓取(urls 数组)
 * - TLD 列自动识别(含 .xx 的单元格)
 * - 价格列按 columnOrder 语义映射
 * - 千分位/货币符号/本地化数字清洗
 */

import { defineAdapter, type AdapterDefinition, type RawPrice, type RegistrarCapabilities, type RateLimitConfig } from "@/packages/adapter-sdk"

export interface TableAdapterConfig {
  slug: string
  name: string
  website: string
  currency: string
  /** 价格页 URL(多页时给数组) */
  urls: string[]
  /**
   * 表格列语义(除 TLD 列外), 按出现顺序。
   * 如 ["register", "renew", "transfer"] 表示 TLD 列之后
   * 第 1 个价格是注册价、第 2 个是续费价、第 3 个是转入价。
   */
  columnOrder: ("register" | "renew" | "transfer" | "restore" | "skip")[]
  /** 数字格式: "1,234.56"(en) 或 "1.234,56"(eu) 或 "1 234,56"(fr),默认 en */
  numberFormat?: "en" | "eu" | "fr"
  /** 每分钟请求数(多页站点用低值),默认 10 */
  rpm?: number
  owner?: string
  version?: string
  capabilities?: RegistrarCapabilities
  rateLimit?: RateLimitConfig
  priority?: number
  /** 额外请求头(部分站点需要 Referer 等) */
  headers?: Record<string, string>
  /** 自定义行过滤(返回 false 跳过该行) */
  rowFilter?: (cells: string[]) => boolean
  /**
   * 浏览器降级(仅当价格表由 JS 渲染、直接 fetch 拿不到时配置)。
   * 配置后工厂自动追加一个 playwright 策略：
   * HTML 解析为空时降级到远程浏览器服务(BROWSER_SERVICE_URL)渲染 +
   * extract.js 提取。waitFor 必填：表格挂载后出现的 CSS 选择器。
   */
  browser?: {
    /** 表格数据挂载后出现的选择器(必填),如 "table.pricing-table tbody tr" */
    waitFor: string
    /** waitFor 等待超时毫秒,默认 30000 */
    waitForTimeoutMs?: number
    /** 提取前滚动到底触发动态加载,默认 true */
    scrollToBottom?: boolean
    /** 模拟地区 locale(影响 GeoIP 分区定价) */
    locale?: string
    /** 初始导航附加请求头 */
    headers?: Record<string, string>
    /** 自定义提取脚本(默认服务端内置 extract.js) */
    script?: string
  }
}

/** 清洗单元格中的价格数字, 失败返回 null */
export function parsePrice(text: string, format: "en" | "eu" | "fr" = "en"): number | null {
  // 去货币符号与空白类字符
  let t = text.replace(/[^\d.,\s\u00a0']/g, "").trim()
  if (!t) return null
  if (format === "fr") {
    // 1 234,56 → 1234.56
    t = t.replace(/[\s\u00a0']/g, "").replace(",", ".")
  } else if (format === "eu") {
    // 1.234,56 → 1234.56
    t = t.replace(/\./g, "").replace(",", ".")
  } else {
    // 1,234.56 → 1234.56
    t = t.replace(/,/g, "")
  }
  const v = Number.parseFloat(t)
  if (!Number.isFinite(v) || v <= 0 || v >= 100_000) return null
  return Math.round(v * 100) / 100
}

/** 从 HTML 中提取全部表格行的纯文本单元格 */
export function extractTableRows(html: string): string[][] {
  const rows: string[][] = []
  const trMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const tr of trMatches) {
    const cells: string[] = []
    const cellMatches = tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []
    for (const cell of cellMatches) {
      const text = cell
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim()
      cells.push(text)
    }
    if (cells.length > 0) rows.push(cells)
  }
  return rows
}

/** 在一行单元格中找出 TLD(形如 .com / .co.uk / "com （eNom）"),返回 [tld, 索引] */
export function findTldCell(cells: string[]): [string, number] | null {
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i].trim()
    // TLD 单元格可能带后端备注(如 ".com（eNom）"),提取前导 tld 即可
    const m = c.match(/^\.?([a-z0-9-]{2,20}(?:\.[a-z0-9-]{2,15}){0,2})(?:\s|$)/i)
    if (m) {
      const tld = m[1].toLowerCase()
      if (/^\./.test(c) || (i === 0 && !/^\d+$/.test(tld))) {
        return [tld, i]
      }
    }
  }
  return null
}

/**
 * createTableAdapter —— 用一份配置生成完整适配器。
 *
 * 动态规则: 若 adapter_rules 表中存在该注册商的 active 规则
 * (由 LLM 修复代理产出),采集时自动覆盖 urls/columnOrder/
 * numberFormat/currency,无需改代码或重新部署。
 */
export function createTableAdapter(config: TableAdapterConfig) {
  /** 本次采集生效的配置(fetch 时解析,parse 复用;适配器并发为 1) */
  let effective: Pick<TableAdapterConfig, "urls" | "columnOrder" | "numberFormat" | "currency"> = config

  const definition: AdapterDefinition = {
    slug: config.slug,
    name: config.name,
    website: config.website,
    owner: config.owner ?? "Data Team",
    version: config.version ?? "1.0.0",
    parserVersion: "1.0.0",
    currency: config.currency,
    priority: config.priority ?? 50,
    capabilities: config.capabilities ?? {
      registration: true,
      renewal: true,
      transfer: true,
      supportedCurrencies: [config.currency],
    },
    rateLimit: config.rateLimit ?? { concurrency: 1, rpm: config.rpm ?? 10, retries: 2, timeoutMs: 60_000 },
    strategies: [
      {
        type: "html",
        url: config.urls[0],
        async fetch(ctx) {
          // 加载 LLM 修复代理产出的动态规则(如有);动态导入避免客户端打包
          effective = config
          try {
            const { getActiveRuleBySlug } = await import("@/packages/ai-repair")
            const rule = await getActiveRuleBySlug(config.slug)
            if (rule) {
              effective = {
                urls: rule.urls,
                columnOrder: rule.columnOrder,
                numberFormat: rule.numberFormat,
                currency: rule.currency,
              }
              ctx.log?.("info", `应用动态规则: ${rule.urls[0]} (${rule.columnOrder.join(",")})`)
            }
          } catch {
            // 规则加载失败不阻塞采集,回退静态配置
          }
          const pages: string[] = []
          for (const url of effective.urls) {
            const res = await ctx.fetch(url, {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
                Accept: "text/html,application/xhtml+xml",
                ...config.headers,
              },
            })
            if (!res.ok) throw new Error(`${config.slug} 价格页 ${url} 返回 HTTP ${res.status}`)
            pages.push(await res.text())
          }
          return pages.join("\n<!--PAGE_BREAK-->\n")
        },
        parse(raw): RawPrice[] {
          const rows = extractTableRows(raw)
          const prices: RawPrice[] = []
          const seen = new Set<string>()
          for (const cells of rows) {
            if (config.rowFilter && !config.rowFilter(cells)) continue
            const tldHit = findTldCell(cells)
            if (!tldHit) continue
            const [tld, tldIdx] = tldHit
            if (seen.has(tld)) continue
            // 收集 TLD 列之后的数字单元格
            const priceValues: (number | null)[] = []
            for (let i = tldIdx + 1; i < cells.length; i++) {
              const v = parsePrice(cells[i], effective.numberFormat)
              priceValues.push(v)
            }
            if (priceValues.every((v) => v === null)) continue
            const price: RawPrice = { tld, currency: effective.currency, sourceUrl: effective.urls[0] }
            let vi = 0
            for (const role of effective.columnOrder) {
              if (vi >= priceValues.length) break
              const value = priceValues[vi]
              vi++
              if (role === "skip") continue
              if (role === "register") price.registerPrice = value
              else if (role === "renew") price.renewPrice = value
              else if (role === "transfer") price.transferPrice = value
              else if (role === "restore") price.restorePrice = value
            }
            if (price.registerPrice == null && price.renewPrice == null && price.transferPrice == null) continue
            seen.add(tld)
            prices.push(price)
          }
          if (prices.length === 0) throw new Error(`${config.slug} 表格解析结果为空(页面结构可能已变化)`)
          return prices
        },
      },
        // JS 渲染表格的浏览器降级：HTML 解析拿不到时，把同一个价格页交给
        // 远程浏览器服务(BROWSER_SERVICE_URL)渲染并提取，再走默认 parse。
        ...(config.browser
          ? [
              {
                type: "playwright" as const,
                url: config.urls[0],
                browser: {
                  extract: "extract-json" as const,
                  waitFor: config.browser.waitFor,
                  waitForTimeoutMs: config.browser.waitForTimeoutMs,
                  scrollToBottom: config.browser.scrollToBottom,
                  locale: config.browser.locale,
                  headers: config.browser.headers,
                  script: config.browser.script,
                },
              },
            ]
          : []),
    ],
  }
  return defineAdapter(definition)
}
