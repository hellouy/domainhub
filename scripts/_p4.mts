import { probeUrl } from "../services/crawl/probe"

// 精简候选(中小国外注册商价目页) —— 只探测, 不写库
const cands: [string, string][] = [
  ["regery", "https://www.regery.com/en/domains/prices"],
  ["101domain", "https://www.101domain.com/domain_pricing.htm"],
  ["netim", "https://www.netim.com/en/domain-names/prices"],
  ["marcaria", "https://www.marcaria.com/ws3/en/domain-name-prices"],
  ["domgate", "https://www.domgate.com/pricing"],
  ["hexonet", "https://www.hexonet.net/pricing"],
]

for (const [slug, url] of cands) {
  try {
    const r = await probeUrl(url)
    console.log(`[p4] ${slug} 策略=${r.strategy} 条数=${r.count} 币种=${r.currency} | ${url}`)
    if (r.count > 0 && r.samples?.length) {
      console.log(`     样例: ${JSON.stringify(r.samples.slice(0, 2))}`)
    }
  } catch (e) {
    console.log(`[p4] ${slug} ERR ${(e as Error).message}`)
  }
}
process.exit(0)
