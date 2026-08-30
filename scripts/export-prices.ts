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
import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"

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
  cloudns: "https://www.cloudns.net/domain-pricing/",
  hostpoint: "https://www.hostpoint.ch/en/domains/domain-prices",
  xserver: "https://www.xserver.ne.jp/domain_price.php",
  value_domain: "https://www.value-domain.com/domain_price/",
  muumuu_domain: "https://muumuu-domain.com/",
  onamae: "https://www.onamae.com/domain/charge/",
  infomaniak: "https://www.infomaniak.com/en/domains",
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
  console.log(`共 ${all.length} 家已注册适配器，开始逐家采集导出…`)

  const out: Record<string, OutRegistrar> = {}
  const collectedAt = new Date().toISOString()

  for (const a of all) {
    const slug = a.slug ?? a.definition.slug
    const ctx = {
      registrarId: 0,
      slug,
      log: async (level: string, message: string) => {
        if (level === "error") console.log(`  [${slug}] ${message}`)
      },
      fetch: (url: string, init?: RequestInit) => fetch(url, init),
      getCredential: async () => null,
      knownTlds: new Set<string>(),
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
        prices.push({
          tld,
          currency: (raw.currency ?? currency).toUpperCase(),
          registerPrice: parsePriceString(raw.registerPrice),
          renewPrice: parsePriceString(raw.renewPrice),
          transferPrice: parsePriceString(raw.transferPrice),
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