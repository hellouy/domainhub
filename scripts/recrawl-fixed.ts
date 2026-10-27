import { db } from "@/lib/db"
import { registrars } from "@/lib/db/schema"
import { eq, inArray } from "drizzle-orm"
import { runCrawlJob } from "@/lib/crawler/runner"

const TARGET_SLUGS = ["onecom", "transip", "netcup", "amen", "internetbs", "registercom", "hover"]

async function main() {
  const rows = await db
    .select()
    .from(registrars)
    .where(inArray(registrars.slug, TARGET_SLUGS))
    .orderBy(registrars.id)

  console.log(`=== 重爬 ${rows.length} 家修复后的注册商 ===\n`)

  for (const r of rows) {
    if (!r.isActive) {
      await db.update(registrars).set({ isActive: true }).where(eq(registrars.id, r.id))
      console.log(`[${r.id}] ${r.slug} — 临时启用`)
    } else {
      console.log(`[${r.id}] ${r.slug} — 已启用`)
    }

    try {
      const result = await runCrawlJob(r.id)
      const status = result.ok ? "成功" : "失败"
      console.log(`  ${status}: 更新 ${result.updated} 条, 共 ${result.totalTlds} 个后缀, 耗时 ${(result.durationMs / 1000).toFixed(1)}s`)
      if (result.error) console.log(`  错误: ${result.error.slice(0, 200)}`)

      if (!result.ok || result.updated === 0) {
        if (r.slug !== "hover") {
          await db.update(registrars).set({ isActive: false }).where(eq(registrars.id, r.id))
          console.log(`  → 恢复禁用`)
        }
      } else {
        console.log(`  → 保持启用`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`  异常: ${msg.slice(0, 200)}`)
      if (r.slug !== "hover") {
        await db.update(registrars).set({ isActive: false }).where(eq(registrars.id, r.id))
        console.log(`  → 恢复禁用`)
      }
    }
    console.log()
  }

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
