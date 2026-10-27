import { alibabacloudAdapter } from "@/adapters/table-registrars"
import { executeStrategies } from "@/packages/adapter-sdk"

async function main() {
  const def = (alibabacloudAdapter as any).definition ?? alibabacloudAdapter
  console.log("Strategies:", def.strategies.map((s: { type: string }) => s.type))
  const ctx = {
    fetch: (url: string, init?: RequestInit) => fetch(url, init),
    log: async (_level: string, msg: string) => { console.log(`  ${msg}`) },
  } as any
  const result = await executeStrategies(def.strategies, ctx) as any
  const prices = result.rawPrices ?? []
  console.log(`Prices: ${prices.length}`)
  for (const p of prices.slice(0, 10)) {
    console.log(`  ${p.tld}: reg=$${p.registerPrice} renew=$${p.renewPrice} transfer=$${p.transferPrice}`)
  }
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
