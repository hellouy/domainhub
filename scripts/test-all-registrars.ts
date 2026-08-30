/**
 * 全部注册商测试 —— 对所有已注册适配器执行策略链干跑
 * ------------------------------------------------------------
 * 覆盖 adapters/index.ts 注册的 31 家：逐家 executeStrategies，
 * 报告命中策略、条数、耗时；playwright 策略经 BROWSER_SERVICE_URL。
 *
 * 运行：BROWSER_SERVICE_URL=http://127.0.0.1:8840 npx tsx scripts/test-all-registrars.ts
 */
import "@/adapters"
import { listRegisteredAdapters } from "@/packages/registry"
import { executeStrategies } from "@/packages/adapter-sdk"

interface Row {
  slug: string
  ok: boolean
  strategy: string
  count: number
  ms: number
  note: string
}

const rows: Row[] = []

async function main() {
  const all = listRegisteredAdapters()
  console.log(`共 ${all.length} 家已注册适配器，开始逐家干跑…\n`)

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
      rows.push({
        slug,
        ok: res.rawPrices.length > 0,
        strategy: res.strategy,
        count: res.rawPrices.length,
        ms: Date.now() - t,
        note: "",
      })
    } catch (err) {
      rows.push({
        slug,
        ok: false,
        strategy: "-",
        count: 0,
        ms: Date.now() - t,
        note: (err as Error).message.slice(0, 120),
      })
    }
  }

  console.log("\n--- 全部注册商干跑结果 ---")
  console.log("slug\t\t\t状态\t策略\t条数\t耗时")
  const maxLen = Math.max(...rows.map((r) => r.slug.length))
  for (const r of rows) {
    console.log(
      `${r.slug.padEnd(maxLen)}\t${r.ok ? "PASS" : "FAIL"}\t${r.strategy.padEnd(12)}\t${String(r.count).padStart(5)}\t${r.ms / 1000}s${r.note ? `\t${r.note}` : ""}`,
    )
  }
  const passed = rows.filter((r) => r.ok).length
  console.log(`\n汇总: ${passed}/${rows.length} 通过`)
  process.exit(passed === rows.length ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})