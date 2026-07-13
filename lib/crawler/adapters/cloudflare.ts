import type { CrawlContext, CrawledPrice, RegistrarAdapter } from "../types"

/**
 * Cloudflare Registrar 真实价格 Adapter
 *
 * 数据源优先级探测结论（2026-07）：
 * 1. 官方 API：Cloudflare 未提供公开的注册商定价 API（定价接口在 dash 后需登录）。
 * 2. JSON 端点：cfdomainpricing.com/prices.json —— 社区持续维护的
 *    Cloudflare Registrar 全量定价数据集（约 400+ 后缀，含更新日期），
 *    这是当前最可靠的机器可读来源，故采用。✓
 * 3. HTML 解析 / Playwright：Cloudflare 官网 tld-policies 页面仅含注册局
 *    政策信息，不含价格，客户端渲染，无需退化到此方案。
 *
 * Cloudflare Registrar 按批发价（成本价）销售：
 * 转入（transfer）价格与续费（renew）价格一致。
 */

const SOURCE_URL = "https://cfdomainpricing.com/prices.json"
const MAX_RETRIES = 3
const TIMEOUT_MS = 60_000

/** prices.json 中单个后缀的结构 */
interface CloudflarePriceEntry {
  registration?: number
  renewal?: number
  updatedAt?: string
}

type CloudflarePriceMap = Record<string, CloudflarePriceEntry>

/** 带超时的 fetch */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "DomainHub/1.0 (price aggregator; +https://domainhub.example)",
        Accept: "application/json",
      },
      cache: "no-store",
    })
  } finally {
    clearTimeout(timer)
  }
}

/** 带重试的 JSON 拉取：最多 3 次，指数退避 */
async function fetchPriceMap(ctx: CrawlContext): Promise<CloudflarePriceMap> {
  let lastError: Error | null = null
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await ctx.log("info", `请求数据源（第 ${attempt}/${MAX_RETRIES} 次）：${SOURCE_URL}`)
      const res = await fetchWithTimeout(SOURCE_URL, TIMEOUT_MS)
      if (!res.ok) throw new Error(`数据源返回 HTTP ${res.status}`)
      const data: unknown = await res.json()
      if (data === null || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("数据源返回了非预期的 JSON 结构")
      }
      return data as CloudflarePriceMap
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const isAbort = lastError.name === "AbortError"
      await ctx.log(
        "warn",
        `第 ${attempt} 次请求失败：${isAbort ? `超时（${TIMEOUT_MS / 1000}s）` : lastError.message}`,
      )
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)))
      }
    }
  }
  throw new Error(`Cloudflare 数据源在 ${MAX_RETRIES} 次重试后仍不可用：${lastError?.message ?? "未知错误"}`)
}

/** 校验并转换单条价格记录，非法数据返回 null */
function toCrawledPrice(tld: string, entry: CloudflarePriceEntry): CrawledPrice | null {
  const register = typeof entry.registration === "number" && entry.registration > 0 ? entry.registration : null
  const renew = typeof entry.renewal === "number" && entry.renewal > 0 ? entry.renewal : null
  if (register === null && renew === null) return null
  return {
    tld: tld.toLowerCase().replace(/^\./, ""),
    registerPrice: register,
    renewPrice: renew,
    // Cloudflare 按成本价销售，转入价与续费价一致
    transferPrice: renew,
    currency: "USD",
    sourceUrl: SOURCE_URL,
  }
}

/**
 * 核心采集函数：返回 { registrar, prices } 结构，
 * 便于独立调用（脚本/测试），Adapter 的 fetchPrices 复用它。
 */
export async function crawl(ctx: CrawlContext): Promise<{ registrar: string; prices: CrawledPrice[] }> {
  const priceMap = await fetchPriceMap(ctx)
  const prices: CrawledPrice[] = []
  let skipped = 0

  for (const [tld, entry] of Object.entries(priceMap)) {
    const price = toCrawledPrice(tld, entry)
    if (price) {
      prices.push(price)
    } else {
      skipped++
    }
  }

  if (prices.length === 0) {
    throw new Error("数据源解析后未得到任何有效价格，放弃写入以保护现有数据")
  }

  await ctx.log("info", `解析完成：有效价格 ${prices.length} 条，跳过无效记录 ${skipped} 条`)
  return { registrar: "cloudflare", prices }
}

export const cloudflareAdapter: RegistrarAdapter = {
  slug: "cloudflare",
  name: "Cloudflare",
  strategy: "真实数据（cfdomainpricing.com JSON 数据集）",
  async fetchPrices(ctx) {
    const { prices } = await crawl(ctx)
    return prices
  },
}
