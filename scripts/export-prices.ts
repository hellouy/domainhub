/**
 * 采集明细导出 —— 把适配器干跑结果落盘为结构化 JSON
 * ------------------------------------------------------------
 * 与 test-all-registrars.ts 同框架（registry + executeStrategies），
 * 但对每家成功适配器做轻量标准化（normalize 的等价逻辑：tld 去点小写、
 * parsePriceString 转数字、currency 默认 definition.currency），
 * 输出可导入数据库的结构化明细。
 *
 * 运行：BROWSER_SERVICE_URL=http://127.0.0.1:8840 npx tsx scripts/export-prices.ts
 * 输出：data/prices-YYYYMMDD.json
 */
import "@/adapters"
import { listRegisteredAdapters } from "@/packages/registry"
import { executeStrategies } from "@/packages/adapter-sdk"
import { parsePriceString } from "@/packages/parser"
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"

/** 用上次导出(或 seed)已覆盖的后缀作为 knownTlds 全集，供"按 knownTlds 取价"型适配器(如 hostinger)扩展覆盖 */
function loadKnownTlds(): Set<string> {
  const out = new Set<string>()
  const candidates = ["data/prices-20260927.json", "data/prices-20260926.json", "data/prices-20260830.json"]
  for (const file of candidates) {
    const abs = join(process.cwd(), file)
    if (!existsSync(abs)) continue
    try {
      const data = JSON.parse(readFileSync(abs, "utf8"))
      for (const r of Object.values(data.registrars ?? {})) {
        for (const p of (r as { prices?: { tld?: string }[] }).prices ?? []) {
          if (p.tld) out.add(p.tld.trim().toLowerCase())
        }
      }
      break
    } catch {
      /* 跳过损坏/缺失文件 */
    }
  }
  return out
}

interface OutPrice {
  tld: string
  currency: string
  registerPrice: number | null
  renewPrice: number | null
  transferPrice: number | null
}

interface OutRegistrar {
  name: string
  website: string
  currency: string
  strategy: string
  collectedAt: string
  prices: OutPrice[]
}

const HOSTS: Record<string, string> = {
  cloudflare: "https://www.cloudflare.com/products/registrar/",
  porkbun: "https://porkbun.com/products/domains",
  namecheap: "https://www.namecheap.com/domains/",
  godaddy: "https://www.godaddy.com/domains",
  dynadot: "https://www.dynadot.com/domain/tlds",
  namecom: "https://www.name.com/domains",
  spaceship: "https://www.spaceship.com/domains/",
  aliyun: "https://wanwang.aliyun.com/domain/tld",
  openprovider: "https://www.openprovider.com/pricing/",
  inwx: "https://www.inwx.com/en/domains",
  cloudns: "https://www.cloudns.net/domain-pricing/",
  hostpoint: "https://www.hostpoint.ch/en/domains/domain-prices",
  xserver: "https://www.xserver.ne.jp/domain_price.php",
  value_domain: "https://www.value-domain.com/domain_price/",
  muumuu_domain: "https://muumuu-domain.com/",
  onamae: "https://www.onamae.com/domain/charge/",
  
  hostinger: "https://www.hostinger.com/domain-names/",
  ovhcloud: "https://www.ovhcloud.com/en/domains/",
  gandi: "https://www.gandi.net/en/domain",
  directnic: "https://www.directnic.com/",
  dreamhost: "https://www.dreamhost.com/domains/",
  forpsi: "https://www.forpsi.com/domains/",
  juming: "https://www.juming.com/",
  blacknight: "https://www.blacknight.com/domain-names/",
  namesilo: "https://www.namesilo.com/",
  truehost: "https://truehost.co.ke/domains/",
  hostingkr: "https://www.hosting.kr/domain",
  "101domain": "https://www.101domain.com/",
  westcn: "https://www.west.cn/",
  "22cn": "https://www.22.cn/",
}

function hostFor(slug: string, def: { currency?: string; strategies?: { url?: string }[] }): string {
  const direct = HOSTS[slug]
  if (direct) return direct
  return def.strategies?.find((s) => s.url)?.url ?? `https://${slug.replace(/_/g, "-")}.com/`
}

async function main() {
  const all = listRegisteredAdapters()
  const knownTlds = loadKnownTlds()
  const only = (process.env.ONLY_SLUGS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const filtered = only.length > 0 ? all.filter((a) => only.includes((a.slug ?? a.definition.slug).toLowerCase())) : all
  console.log(`共 ${filtered.length} 家已注册适配器，开始逐家采集导出…(knownTlds=${knownTlds.size})`)

  const out: Record<string, OutRegistrar> = {}
  const collectedAt = new Date().toISOString()

  for (const a of filtered) {
    const slug = a.slug ?? a.definition.slug
    const ctx = {
      registrarId: 0,
      slug,
      log: async (level: string, message: string) => {
        if (level === "error") console.log(`  [${slug}] ${message}`)
      },
      fetch: (url: string, init?: RequestInit) => fetch(url, init),
      getCredential: async () => null,
      knownTlds,
      addRetry: () => {},
    } as never

    const t = Date.now()
    try {
      const res = await executeStrategies(a.definition.strategies, ctx)
      if (res.rawPrices.length === 0) {
        console.log(`  ${slug.padEnd(18)} FAIL（0 条）`)
        continue
      }
      const def = a.definition as { currency?: string }
      const currency = def.currency ?? "USD"
      const prices: OutPrice[] = []
      const seen = new Set<string>()
      for (const raw of res.rawPrices) {
        const tld = (raw.tld ?? "").trim().toLowerCase().replace(/^\./, "")
        if (!tld || seen.has(tld)) continue
        seen.add(tld)
        let registerPrice = parsePriceString(raw.registerPrice)
        const renewPrice = parsePriceString(raw.renewPrice)
        const transferPrice = parsePriceString(raw.transferPrice)
        /** 散射保护：取消价远低于续费价（<1/50）视为脏数据，置 null 兜底（如 onamae .com reg=¥2） */
        if (
          registerPrice != null &&
          renewPrice != null &&
          renewPrice > 0 &&
          registerPrice < renewPrice / 50
        ) {
          registerPrice = null
        }
        /** 促销贴纸归一：注册价 < 续费价/3 视为首年促销贴纸（如 name.com $1 vs $30），
          *  为保证各注册商 register 列口径一致（都报"标准注册价"），置 null 让前端以续费价兜底 */
        if (
          registerPrice != null &&
          renewPrice != null &&
          renewPrice > 0 &&
          registerPrice > 0 &&
          registerPrice < renewPrice / 3
        ) {
          registerPrice = null
        }
        /** 单值误解析兜底：register 为极小整数(<=2)而续费/转入均缺失(如 forpsi "1 rok"→1 CZK)，
          *  明显是 term/数量列被误当价格，置 null */
        if (
          registerPrice != null &&
          registerPrice <= 2 &&
          renewPrice == null &&
          transferPrice == null
        ) {
          registerPrice = null
        }
        prices.push({
          tld,
          currency: (raw.currency ?? currency).toUpperCase(),
          registerPrice,
          renewPrice,
          transferPrice,
        })
      }
      if (prices.length === 0) continue
      out[slug] = {
        name: a.definition.name,
        website: hostFor(slug, a.definition),
        currency,
        strategy: res.strategy,
        collectedAt,
        prices,
      }
      console.log(`  ${slug.padEnd(18)} PASS  ${String(prices.length).padStart(5)} 条  ${((Date.now() - t) / 1000).toFixed(1)}s`)
    } catch (err) {
      console.log(`  ${slug.padEnd(18)} FAIL  ${(err as Error).message.slice(0, 90)}`)
    }
  }

  const date = collectedAt.slice(0, 10).replace(/-/g, "")
  const dir = join(process.cwd(), "data")
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `prices-${date}.json`)
  writeFileSync(file, JSON.stringify({ collectedAt, registrars: out }, null, 2))
  let total = 0
  for (const r of Object.values(out)) total += r.prices.length
  console.log(`\n已导出 ${Object.keys(out).length} 家 / ${total} 条 → ${file}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})