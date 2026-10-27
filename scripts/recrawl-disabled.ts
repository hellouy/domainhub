/**
 * 批量重爬已禁用注册商：临时启用 → 触发采集 → 记录结果 → 恢复原状态
 *
 * 用法: set -a && . ./.env.local && set +a && npx tsx scripts/recrawl-disabled.ts
 */
import { db } from "@/lib/db"
import { registrars } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { runCrawlJob } from "@/lib/crawler/runner"
import { getRegisteredAdapter } from "@/packages/registry"

async function main() {
  // 取全部已禁用注册商
  const disabled = await db
    .select()
    .from(registrars)
    .where(eq(registrars.isActive, false))
    .orderBy(registrars.id)

  console.log(`=== ${disabled.length} 家已禁用注册商，开始重爬测试 ===\n`)

  const results: Array<{
    id: number
    slug: string
    name: string
    hasAdapter: boolean
    ok: boolean
    updated: number
    totalTlds: number
    durationMs: number
    error?: string
  }> = []

  for (const r of disabled) {
    const hasAdapter = !!getRegisteredAdapter(r.slug)
    console.log(`[${r.id}] ${r.slug} (${r.name}) — 适配器: ${hasAdapter ? "有" : "无"}`)

    if (!hasAdapter) {
      console.log(`  跳过：无适配器\n`)
      results.push({ id: r.id, slug: r.slug, name: r.name, hasAdapter: false, ok: false, updated: 0, totalTlds: 0, durationMs: 0, error: "无适配器" })
      continue
    }

    // 临时启用
    await db.update(registrars).set({ isActive: true }).where(eq(registrars.id, r.id))

    try {
      const result = await runCrawlJob(r.id)
      const status = result.ok ? "成功" : "失败"
      console.log(`  ${status}: 更新 ${result.updated} 条, 共 ${result.totalTlds} 个后缀, 耗时 ${(result.durationMs / 1000).toFixed(1)}s`)
      if (result.error) console.log(`  错误: ${result.error.slice(0, 200)}`)
      console.log()
      results.push({
        id: r.id, slug: r.slug, name: r.name, hasAdapter: true,
        ok: result.ok, updated: result.updated, totalTlds: result.totalTlds,
        durationMs: result.durationMs, error: result.error,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`  异常: ${msg.slice(0, 200)}\n`)
      results.push({ id: r.id, slug: r.slug, name: r.name, hasAdapter: true, ok: false, updated: 0, totalTlds: 0, durationMs: 0, error: msg })
    }

    // 如果采集失败且没拿到任何新数据，恢复禁用
    const success = results[results.length - 1]
    if (!success.ok || success.updated === 0) {
      await db.update(registrars).set({ isActive: false }).where(eq(registrars.id, r.id))
      console.log(`  → 恢复禁用（无有效数据）`)
    } else {
      console.log(`  → 保持启用（采到 ${success.updated} 条价格）`)
    }
    console.log()
  }

  // 汇总
  console.log("\n=== 重爬汇总 ===")
  const succeeded = results.filter((r) => r.ok && r.updated > 0)
  const failed = results.filter((r) => !r.ok || r.updated === 0)
  console.log(`成功: ${succeeded.length} | 失败: ${failed.length}`)

  if (succeeded.length > 0) {
    console.log("\n--- 可恢复启用的注册商 ---")
    for (const r of succeeded) {
      console.log(`  [${r.id}] ${r.slug} | ${r.name} | 更新 ${r.updated} 条 | ${r.totalTlds} 后缀 | ${(r.durationMs / 1000).toFixed(1)}s`)
    }
  }

  if (failed.length > 0) {
    console.log("\n--- 仍然失败的注册商 ---")
    for (const r of failed) {
      console.log(`  [${r.id}] ${r.slug} | ${r.name} | ${r.error?.slice(0, 100) ?? "-"}`)
    }
  }

  process.exit(0)
}

main().catch((err) => {
  console.error("脚本异常:", err)
  process.exit(1)
})
