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
   * LLM 兜底解析: 默认 true。当 html 表格策略解析为空(页面价格不在标准
   * <table> 里,如卡片/列表布局)且已配置 ZHIPU_API_KEY 时,自动降级用
   * LLM 从 HTML 抽取价格。仅在传统解析失败时触发,不产生无谓 token 消耗。
   * 置为 false 可对特定注册商禁用。
   */
  llmFallback?: boolean
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

/** 促销/状态噪音标签,常紧跟在 TLD 后(如 ".com Hot"、".net New") */
const TLD_NOISE = /\b(hot|new|sale|popular|promo|best|top|deal|special|featured|热门|新|促销)\b/gi

/** 在一行单元格中找出 TLD(形如 .com / .co.uk),返回 [tld, 索引] */
export function findTldCell(cells: string[]): [string, number] | null {
  for (let i = 0; i < cells.length; i++) {
    // 先剥离尾部促销标签(".com Hot" -> ".com"),再判定
    const cleaned = cells[i].replace(TLD_NOISE, "").replace(/\s+/g, " ").trim()
    const m = cleaned.match(/^\.?([a-z0-9-]{1,63}(?:\.[a-z0-9-]{1,63}){0,2})$/i)
    if (m && /^\./.test(cleaned) === true) {
      return [m[1].toLowerCase(), i]
    }
    // 单元格以 .tld 开头、后面跟噪音/空格(如 ".com Hot"):提取开头的 TLD token
    const lead = cells[i].trim().match(/^\.([a-z0-9-]{2,63}(?:\.[a-z0-9-]{2,63}){0,2})\b/i)
    if (lead) return [lead[1].toLowerCase(), i]
    // 也接受不带点但看起来像 TLD 的首列(如 "com")——仅限第一列且长度合理
    if (i === 0) {
      const m2 = cleaned.match(/^([a-z0-9-]{2,20}(?:\.[a-z0-9-]{2,10})?)$/i)
      if (m2 && !/^\d+$/.test(cleaned)) return [m2[1].toLowerCase(), i]
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
            // 不再硬编码 UA/Accept：平台 fetch 层已默认发送完整真实浏览器头，
            // 这里只在适配器需要时追加专用头（如 Referer）。
            const res = await ctx.fetch(url, config.headers ? { headers: config.headers } : undefined)
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
    ],
  }

  // LLM 兜底策略: 追加到策略链末端。只有当上面的 html 策略解析为空、
  // 降级到此、且已配置 ZHIPU_API_KEY 时才真正调用 LLM。
  if (config.llmFallback !== false) {
    definition.strategies.push({
      type: "html",
      url: effective.urls?.[0] ?? config.urls[0],
      async fetch(ctx) {
        const { isLlmConfigured } = await import("@/packages/llm-parser")
        if (!isLlmConfigured()) {
          // 未配置 LLM: 直接失败,让策略引擎归类为普通失败(不误导为可解析)
          throw new Error(`${config.slug} LLM 兜底未启用(未配置 ZHIPU_API_KEY)`)
        }
        const pages: string[] = []
        for (const url of effective.urls) {
          const res = await ctx.fetch(url, config.headers ? { headers: config.headers } : undefined)
          if (!res.ok) throw new Error(`${config.slug} 价格页 ${url} 返回 HTTP ${res.status}`)
          pages.push(await res.text())
        }
        return pages.join("\n<!--PAGE_BREAK-->\n")
      },
      async parse(raw, ctx): Promise<RawPrice[]> {
        const { extractPricesWithLlm } = await import("@/packages/llm-parser")
        await ctx.log("info", `${config.slug} 传统解析为空,启用 LLM 兜底抽取`)
        const result = await extractPricesWithLlm(raw, {
          registrar: config.name,
          currency: effective.currency,
          sourceUrl: effective.urls[0],
        })
        const currency =
          result.currency && result.currency !== "UNKNOWN" ? result.currency : effective.currency
        const prices: RawPrice[] = []
        const seen = new Set<string>()
        for (const row of result.prices) {
          const tld = row.tld.trim().replace(/^\./, "").toLowerCase()
          if (!tld || seen.has(tld)) continue
          if (row.registerPrice == null && row.renewPrice == null && row.transferPrice == null) continue
          seen.add(tld)
          prices.push({
            tld,
            currency,
            registerPrice: row.registerPrice,
            renewPrice: row.renewPrice,
            transferPrice: row.transferPrice,
            sourceUrl: effective.urls[0],
          })
        }
        await ctx.log("info", `${config.slug} LLM 抽取到 ${prices.length} 条价格`)
        if (prices.length === 0) throw new Error(`${config.slug} LLM 兜底也未抽取到价格`)
        return prices
      },
    })
  }

  return defineAdapter(definition)
}
