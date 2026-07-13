/**
 * 适配器测试脚本 —— 对任意已注册的适配器执行 8 类标准测试
 * ------------------------------------------------------------
 * 所有权: Platform Team
 * 文档: docs/how-to-add-registrar.md(第 4 步)
 *
 * 用法:
 *   npx tsx scripts/test-adapter.ts <slug>            # 全部测试
 *   npx tsx scripts/test-adapter.ts <slug> --no-db    # 跳过数据库写入(Storage Test 用干跑)
 *
 * 测试项:
 *   1. Connection Test  —— initialize + discover 能拿到数据源
 *   2. Fetch Test       —— 策略引擎能成功下载原始数据
 *   3. Parse Test       —— parse 产出 ≥1 条原始记录
 *   4. Normalize Test   —— normalize 产出标准价格模型且字段齐全
 *   5. Validation Test  —— 校验平台通过率 ≥ 90%
 *   6. Storage Test     —— 价格能写入(或干跑统计)
 *   7. Coverage Test    —— 已知 TLD 覆盖率 ≥ 50%
 *   8. Health Test      —— 采集后健康分 ≥ 50
 */

import { eq } from "drizzle-orm"
import { getRegisteredAdapter, listRegisteredAdapters } from "@/packages/registry"
import "@/adapters"

const slug = process.argv[2]
const noDb = process.argv.includes("--no-db")

interface TestResult {
  name: string
  ok: boolean
  detail: string
}

async function main() {
  if (!slug) {
    console.log("用法: npx tsx scripts/test-adapter.ts <slug> [--no-db]")
    console.log("已注册的适配器:", listRegisteredAdapters().map((a) => a.slug).join(", "))
    process.exit(1)
  }

  const adapter = getRegisteredAdapter(slug)
  if (!adapter) {
    console.error(`未找到适配器 "${slug}"。已注册: ${listRegisteredAdapters().map((a) => a.slug).join(", ")}`)
    process.exit(1)
  }

  console.log(`\n=== 适配器测试: ${slug} (adapter v${adapter.version}, parser v${adapter.parserVersion}, sdk v${adapter.sdkVersion}) ===\n`)

  const results: TestResult[] = []
  const { db } = await import("@/lib/db")
  const { registrars } = await import("@/lib/db/schema")
  const [registrar] = await db.select().from(registrars).where(eq(registrars.slug, slug))
  if (!registrar) {
    console.error(`数据库中不存在 slug 为 "${slug}" 的注册商,请先在后台添加。`)
    process.exit(1)
  }

  const { createPriceSink, createDryRunSink } = await import("@/packages/storage")
  const { rateLimitedFetch } = await import("@/packages/adapter-sdk")

  const sinkBundle = noDb ? await createDryRunSink(registrar.id) : await createPriceSink(registrar.id)

  const logs: string[] = []
  const ctx = {
    registrarId: registrar.id,
    slug,
    log: async (level: string, message: string) => {
      logs.push(`[${level}] ${message}`)
    },
    fetch: (url: string, init?: RequestInit) => rateLimitedFetch(slug, url, init, adapter.definition.rateLimit),
    getCredential: async () => null,
    knownTlds: sinkBundle.knownTlds,
    addRetry: () => {},
  }

  // 通过 SDK 的分步测试接口执行
  const report = await adapter.runTests(ctx as never, sinkBundle.sink)

  results.push({ name: "1. Connection Test", ok: report.connection.ok, detail: report.connection.detail })
  results.push({ name: "2. Fetch Test", ok: report.fetch.ok, detail: report.fetch.detail })
  results.push({ name: "3. Parse Test", ok: report.parse.ok, detail: report.parse.detail })
  results.push({ name: "4. Normalize Test", ok: report.normalize.ok, detail: report.normalize.detail })
  results.push({ name: "5. Validation Test", ok: report.validation.ok, detail: report.validation.detail })
  results.push({ name: "6. Storage Test", ok: report.storage.ok, detail: report.storage.detail })
  results.push({ name: "7. Coverage Test", ok: report.coverage.ok, detail: report.coverage.detail })

  // 8. Health Test —— 基于本次运行推算
  const healthOk = report.validation.ok && report.coverage.ok && report.fetch.ok
  results.push({
    name: "8. Health Test",
    ok: healthOk,
    detail: healthOk ? "本次运行推算健康分 ≥ 50" : "存在失败项, 健康分将低于阈值",
  })

  console.log("")
  let pass = 0
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}  ${r.detail}`)
    if (r.ok) pass++
  }
  console.log(`\n结果: ${pass}/${results.length} 通过${noDb ? "(干跑模式, 未写入数据库)" : ""}`)
  if (logs.length > 0) {
    console.log("\n--- 适配器日志 ---")
    for (const l of logs.slice(0, 20)) console.log(l)
  }
  process.exit(pass === results.length ? 0 : 1)
}

main()
