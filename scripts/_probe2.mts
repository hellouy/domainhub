/**
 * 一次性批量探测候选注册商价格页(用完删除)。
 * 复用 probeUrl 服务, 报告命中策略/条数/币种/捕获端点, 决定接入方式。
 */
import { probeUrl } from "../services/crawl/probe"

const candidates: { name: string; url: string }[] = [
  // 用户点名
  { name: "西部数码 west.cn", url: "https://www.west.cn/services/domain/" },
  { name: "西部数码 价目", url: "https://www.west.cn/domains/pricing.html" },
  { name: "阿里云国外站 alibabacloud", url: "https://www.alibabacloud.com/domain" },
  { name: "阿里云国外站 price", url: "https://www.alibabacloud.com/domain/price" },
  // 中小国外注册商
  { name: "Hostinger", url: "https://www.hostinger.com/tld" },
  { name: "IONOS", url: "https://www.ionos.com/domains/domain-names" },
  { name: "Gname", url: "https://www.gname.com/en" },
  { name: "Cosmotown", url: "https://www.cosmotown.com/domain-pricing" },
  { name: "Regery", url: "https://www.regery.com/en/domains/prices" },
  { name: "Marcaria", url: "https://www.marcaria.com/ws/en/domains/domain-prices" },
  { name: "101domain", url: "https://www.101domain.com/domain_pricing.htm" },
  { name: "NameBright", url: "https://www.namebright.com/DomainPricing" },
  { name: "ClouDNS", url: "https://www.cloudns.net/domains/" },
  { name: "Domain.com", url: "https://www.domain.com/domains/" },
  { name: "DNSPod Intl", url: "https://www.dnspod.com" },
  { name: "Hexonet", url: "https://www.hexonet.net/domain-price-list" },
]

const results: string[] = []
for (const c of candidates) {
  const t0 = Date.now()
  try {
    const r = await probeUrl(c.url)
    const ms = ((Date.now() - t0) / 1000).toFixed(1)
    const ep = r.capturedEndpoints?.length ? ` xhr=${r.capturedEndpoints.length}` : ""
    const line = `${r.ok ? "OK " : "FAIL"} | ${c.name.padEnd(22)} | ${r.strategy.padEnd(13)} | ${String(r.count).padStart(4)}条 | ${r.currency.padEnd(7)} | ${ms}s${ep}`
    console.log("[p2]", line)
    results.push(line)
    if (r.ok && r.samples.length) {
      console.log("     样例:", r.samples.slice(0, 3).map((s) => `${s.tld}=${s.registerPrice ?? "?"}`).join(", "))
    }
  } catch (e) {
    console.log("[p2] ERR |", c.name, (e as Error).message.slice(0, 80))
  }
}
console.log("\n=== 汇总 ===")
for (const l of results) console.log(l)
process.exit(0)
