import { probeUrl } from "../services/crawl/probe"

// 一批候选注册商价格页(混合难度: 静态表/JS 渲染/XHR API/Cloudflare)
const URLS: { slug: string; url: string }[] = [
  { slug: "porkbun", url: "https://porkbun.com/products/domain_pricing" },
  { slug: "namesilo", url: "https://www.namesilo.com/pricing" },
  { slug: "spaceship", url: "https://www.spaceship.com/domain-names/" },
  { slug: "name.com", url: "https://www.name.com/pricing" },
  { slug: "gandi", url: "https://www.gandi.net/en/domain" },
  { slug: "hexonet", url: "https://www.hexonet.net/domain-price-list" },
  { slug: "regery", url: "https://www.regery.com/en/domains/prices" },
  { slug: "cosmotown", url: "https://www.cosmotown.com/pricing" },
  { slug: "domize", url: "https://www.101domain.com/domain_pricing.htm" },
  { slug: "dreamhost", url: "https://www.dreamhost.com/domains/" },
  { slug: "west.cn", url: "https://www.west.cn/services/domain/price.asp" },
  { slug: "ename", url: "https://www.ename.net/pricing" },
]

async function main() {
  console.log("[batch] 开始批量探测", URLS.length, "个候选注册商\n")
  const results: { slug: string; ok: boolean; strategy: string; count: number; currency: string; ms: number; endpoints?: number; err?: string }[] = []
  for (const { slug, url } of URLS) {
    const t0 = Date.now()
    try {
      const r = await probeUrl(url)
      const ms = Date.now() - t0
      results.push({ slug, ok: r.ok, strategy: r.strategy, count: r.count, currency: r.currency, ms, endpoints: r.capturedEndpoints?.length })
      console.log(`[batch] ${slug.padEnd(12)} ${r.ok ? "OK " : "FAIL"} 策略=${r.strategy.padEnd(14)} 条数=${String(r.count).padStart(5)} 币种=${r.currency.padEnd(8)} 耗时=${String(ms).padStart(6)}ms${r.capturedEndpoints?.length ? ` XHR端点=${r.capturedEndpoints.length}` : ""}`)
      if (!r.ok) console.log(`         └─ ${r.message}${r.error ? " | " + r.error : ""}`)
    } catch (e) {
      const ms = Date.now() - t0
      results.push({ slug, ok: false, strategy: "throw", count: 0, currency: "-", ms, err: e instanceof Error ? e.message : String(e) })
      console.log(`[batch] ${slug.padEnd(12)} THROW 耗时=${ms}ms | ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  const ok = results.filter((r) => r.ok).length
  const totalMs = results.reduce((a, r) => a + r.ms, 0)
  console.log(`\n[batch] 汇总: 成功 ${ok}/${URLS.length}  总耗时 ${(totalMs / 1000).toFixed(1)}s  平均 ${Math.round(totalMs / URLS.length)}ms/个`)
  console.log("[batch] 按策略分布:", JSON.stringify(results.reduce<Record<string, number>>((a, r) => { const k = r.ok ? r.strategy : "fail"; a[k] = (a[k] || 0) + 1; return a }, {})))
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
