import { probeUrl } from "../services/crawl/probe"

const candidates: { name: string; url: string }[] = [
  // 西部数码真实价目页候选
  { name: "west.cn price.asp", url: "https://www.west.cn/services/domain/price.asp" },
  { name: "west.cn domain", url: "https://www.west.cn/domain/" },
  { name: "west263 intl", url: "https://www.west263.com/services/domain/" },
  { name: "363.hk", url: "https://www.363.hk/domain/" },
  // 阿里云国外站候选
  { name: "aliyun intl domain", url: "https://www.alibabacloud.com/domain?spm=" },
  { name: "aliyun help price", url: "https://www.alibabacloud.com/help/en/domain/pricing/" },
  // 确认币种/全量: ClouDNS & NameBright
  { name: "ClouDNS", url: "https://www.cloudns.net/domains/" },
  { name: "NameBright", url: "https://www.namebright.com/DomainPricing" },
]

for (const c of candidates) {
  const t0 = Date.now()
  try {
    const r = await probeUrl(c.url)
    const ms = ((Date.now() - t0) / 1000).toFixed(1)
    console.log("[p3]", `${r.ok ? "OK " : "FAIL"} | ${c.name.padEnd(20)} | ${r.strategy.padEnd(13)} | ${String(r.count).padStart(4)}条 | ${r.currency} | ${ms}s`)
    if (r.ok && r.samples.length) {
      console.log("     样例:", r.samples.slice(0, 6).map((s) => `${s.tld}=${s.registerPrice ?? "?"}/${s.renewPrice ?? "?"}`).join(", "))
      if (r.capturedEndpoints?.length) console.log("     端点:", r.capturedEndpoints.slice(0, 5).join("  "))
    }
  } catch (e) {
    console.log("[p3] ERR |", c.name, (e as Error).message.slice(0, 80))
  }
}
process.exit(0)
