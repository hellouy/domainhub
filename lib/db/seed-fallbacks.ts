/**
 * 无数据库时的种子兜底数据（演示/本地预览）
 * ------------------------------------------------------------
 * 原程序数据存在共享 Neon Postgres（DATABASE_URL）。开发环境无可用
 * 数据库时（本地无 PG / Neon 配额耗尽），safeQuery 兜底为空数组导致页面
 * 只有骨架。此模块用 SEED_PRICES 构造与 queries.ts 返回类型一致的完整视图，
 * 让原程序在无 DB 时仍以「原来的样子」显示完整数据。
 *
 * 所有权: Data Team
 */

import { SEED_PRICES, SEED_SOURCE_URLS } from "@/lib/crawler/seed-data"
import type { StatsRow } from "@/lib/db/queries"

type PriceTuple = [number | null, number | null, number | null]

const REGISTRAR_META: Record<string, { name: string; website: string; description: string }> = {
  cloudflare: { name: "Cloudflare Registrar", website: "https://www.cloudflare.com", description: "成本价注册，无加价。API 直采 427 个 TLD 全定价。" },
  porkbun: { name: "Porkbun", website: "https://porkbun.com", description: "平价口碑注册商，907 个 TLD 真价采集。" },
  namecheap: { name: "Namecheap", website: "https://www.namecheap.com", description: "全球知名注册商（API 凭证待配置）。" },
  godaddy: { name: "GoDaddy", website: "https://www.godaddy.com", description: "全球最大注册商（API 凭证待配置）。" },
  dynadot: { name: "Dynadot", website: "https://www.dynadot.com", description: "支持 800+ 后缀（Cloudflare 反爬，接口重放中）。" },
  namecom: { name: "Name.com", website: "https://www.name.com", description: "浏览器提取 590 个 TLD 注册/续费/转入价（USD）。" },
  spaceship: { name: "Spaceship", website: "https://www.spaceship.com", description: "Hostinger 旗下新锐注册商。" },
  aliyun: { name: "阿里云万网", website: "https://wanwang.aliyun.com", description: "中国最大域名注册平台。" },
}

const POPULAR = new Set(["com", "net", "org", "io", "ai", "co", "me", "dev", "app", "xyz", "top", "cc", "sh", "cn"])
export const POPULAR_TLDS = [...POPULAR]

// —— 确定性 seed 域（固定排序后分配 id，保证各函数一致）——
const tldList = new Set<string>()
const tldCountByTld = new Map<string, number>()
const minByTld = new Map<string, number>()
for (const tlds of Object.values(SEED_PRICES)) {
  for (const [tld, [reg]] of Object.entries(tlds)) {
    const v = Math.max(reg ?? 1, 1)
    if (minByTld.has(tld)) minByTld.set(tld, Math.min(minByTld.get(tld)!, v))
    else minByTld.set(tld, v)
    tldCountByTld.set(tld, (tldCountByTld.get(tld) ?? 0) + 1)
    tldList.add(tld)
  }
}
const sortedTlds = [...tldList].sort()
const tldToId = new Map<string, number>()
sortedTlds.forEach((t, i) => tldToId.set(t, i + 1))

const registrarSlugs = Object.keys(SEED_PRICES).sort()
const slugToId = new Map<string, number>()
registrarSlugs.forEach((s, i) => slugToId.set(s, i + 1))

function metaFor(slug: string) {
  return REGISTRAR_META[slug] ?? { name: slug, website: `https://${slug}.com`, description: "" }
}

function nowIso() {
  return new Date().toISOString()
}

function nowDate() {
  return new Date()
}

function usd(v: number | null): string | null {
  return v === null ? null : v.toFixed(8)
}

// —— 与 queries.ts 返回类型对齐的视图 ——

export interface RegistrarRow {
  id: number
  slug: string
  name: string
  website: string
  description: string
  icannAccredited: boolean
  whoisPrivacy: boolean
  dnssec: boolean
  tldCount: number
  paymentMethods: string[]
  logoUrl: string | null
  isActive: boolean
  createdAt: Date
  health: Record<string, unknown> | null
  owner: string | null
  adapterVersion: string | null
  priority: number | null
}

export interface TldRow {
  id: number
  tld: string
  type: string
  description: string
  isPopular: boolean
  createdAt: Date
  isValid: boolean
  popularity: number
}

export interface TldMinPriceRow {
  id: number
  tld: string
  type: string
  isPopular: boolean
  popularity: number
  minRegister: string | null
  registrarCount: number
}

export interface PriceForTldRow {
  priceId: number
  registerPrice: string | null
  renewPrice: string | null
  transferPrice: string | null
  currency: string
  sourceUrl: string | null
  updatedAt: Date
  registrarId: number
  registrarSlug: string
  registrarName: string
  registrarWebsite: string
}

export interface PriceForRegistrarRow {
  priceId: number
  registerPrice: string | null
  renewPrice: string | null
  transferPrice: string | null
  currency: string
  updatedAt: Date
  tldId: number
  tld: string
  tldType: string
}

export function seedStats(): StatsRow {
  let priceCount = 0
  for (const tlds of Object.values(SEED_PRICES)) priceCount += Object.keys(tlds).length
  return {
    registrarCount: registrarSlugs.length,
    tldCount: sortedTlds.length,
    priceCount,
    lastUpdated: nowIso(),
  }
}

export function seedTldsWithMinPrice(onlyPopular = false): TldMinPriceRow[] {
  const rows: TldMinPriceRow[] = sortedTlds
    .filter((t) => !onlyPopular || POPULAR.has(t))
    .map((t) => ({
      id: tldToId.get(t)!,
      tld: t,
      type: "gTLD",
      isPopular: POPULAR.has(t),
      popularity: POPULAR.has(t) ? 100 : 0,
      minRegister: usd(minByTld.get(t) ?? null),
      registrarCount: tldCountByTld.get(t) ?? 0,
    }))
  rows.sort((a, b) =>
    a.isPopular === b.isPopular ? (a.isPopular ? -1 : 0) : b.isPopular ? 1 : -1,
  )
  return rows
}

export function seedActiveRegistrars() {
  return registrarSlugs.map((slug) => {
    const meta = metaFor(slug)
    return {
      id: slugToId.get(slug)!,
      slug,
      name: meta.name,
      website: meta.website,
      description: meta.description,
      icannAccredited: true,
      whoisPrivacy: true,
      dnssec: true,
      tldCount: Object.keys(SEED_PRICES[slug]).length,
    }
  })
}

export function seedRegistrarBySlug(slug: string): RegistrarRow | null {
  const s = registrarSlugs.includes(slug) ? slug : registrarSlugs.find((x) => x === slug)
  if (!s) return null
  const meta = metaFor(s)
  return {
    id: slugToId.get(s)!,
    slug: s,
    name: meta.name,
    website: meta.website,
    description: meta.description,
    icannAccredited: true,
    whoisPrivacy: true,
    dnssec: true,
    tldCount: Object.keys(SEED_PRICES[s]).length,
    paymentMethods: ["Credit Card", "PayPal", "Alipay"],
    logoUrl: null,
    isActive: true,
    createdAt: nowDate(),
    health: null,
    owner: null,
    adapterVersion: null,
    priority: null,
  }
}

export function seedTldByName(tld: string): TldRow | null {
  const t = tld.toLowerCase()
  const id = tldToId.get(t)
  if (id === undefined) return null
  return {
    id,
    tld: t,
    type: "gTLD",
    description: "",
    isPopular: POPULAR.has(t),
    createdAt: nowDate(),
    isValid: true,
    popularity: POPULAR.has(t) ? 100 : 0,
  }
}

export function seedPricesForTld(tldId: number): PriceForTldRow[] {
  let target: string | null = null
  for (const [t, id] of tldToId) if (id === tldId) target = t
  if (!target) return []
  const rows: PriceForTldRow[] = []
  let priceId = 1
  for (const slug of registrarSlugs) {
    const prices = SEED_PRICES[slug][target]
    if (!prices) continue
    if (!prices.some((p) => p !== null)) continue
    const meta = metaFor(slug)
    rows.push({
      priceId: priceId++,
      registerPrice: usd(prices[0]),
      renewPrice: usd(prices[1]),
      transferPrice: usd(prices[2]),
      currency: "USD",
      sourceUrl: SEED_SOURCE_URLS[slug] ?? meta.website,
      updatedAt: nowDate(),
      registrarId: slugToId.get(slug)!,
      registrarSlug: slug,
      registrarName: meta.name,
      registrarWebsite: meta.website,
    })
  }
  rows.sort((a, b) => (parseFloat(a.registerPrice ?? "9e9") ) - parseFloat(b.registerPrice ?? "9e9"))
  return rows
}

export function seedPricesForRegistrar(registrarId: number): PriceForRegistrarRow[] {
  let target: string | null = null
  for (const [s, id] of slugToId) if (id === registrarId) target = s
  if (!target) return []
  const rows: PriceForRegistrarRow[] = []
  for (const [tld, prices] of Object.entries(SEED_PRICES[target])) {
    rows.push({
      priceId: rows.length + 1,
      registerPrice: usd(prices[0]),
      renewPrice: usd(prices[1]),
      transferPrice: usd(prices[2]),
      currency: "USD",
      updatedAt: nowDate(),
      tldId: tldToId.get(tld)!,
      tld,
      tldType: "gTLD",
    })
  }
  rows.sort((a, b) => a.tld.localeCompare(b.tld))
  return rows
}

export function seedTldLastUpdated(tldId: number): Date | null {
  return [...tldToId.values()].includes(tldId) ? nowDate() : null
}