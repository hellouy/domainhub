import "@/adapters"
import { getRegisteredAdapter } from "@/packages/registry"
import { executeStrategies } from "@/packages/adapter-sdk"

async function main() {
  const ctx = {
    registrarId: 0,
    slug: "",
    log: async () => {},
    fetch: (url: string, init?: RequestInit) => fetch(url, init),
    getCredential: async () => null,
    knownTlds: new Set<string>(),
    addRetry: () => {},
  } as never
  for (const slug of ["centralnic", "dynadot", "exabytes", "networksolutions"]) {
    const a = getRegisteredAdapter(slug)
    if (!a) {
      console.log(`${slug}\tNOT-REGISTERED`)
      continue
    }
    const t = Date.now()
    try {
      const res = await executeStrategies(a.definition.strategies, ctx)
      const s = res.rawPrices[0]
      console.log(
        `${slug}\tPASS\t${res.rawPrices.length} rows\t${res.strategy}\t${((Date.now() - t) / 1000).toFixed(1)}s\t${s ? `${s.tld} ${s.currency} ${s.registerPrice ?? "-"}/${s.renewPrice ?? "-"}/${s.transferPrice ?? "-"}` : ""}`,
      )
    } catch (e) {
      console.log(`${slug}\tFAIL\t${(e as Error).message.slice(0, 140)}`)
    }
  }
}
main()