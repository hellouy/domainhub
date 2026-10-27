import { db } from "@/lib/db"
import { registrars } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { runCrawlJob } from "@/lib/crawler/runner"

async function main() {
  const [r] = await db.select().from(registrars).where(eq(registrars.slug, "onecom"))
  if (!r) { console.log("onecom not found"); process.exit(1) }

  console.log(`[${r.id}] ${r.slug} — isActive=${r.isActive}`)
  if (!r.isActive) {
    await db.update(registrars).set({ isActive: true }).where(eq(registrars.id, r.id))
    console.log("  → 临时启用")
  }

  try {
    const result = await runCrawlJob(r.id)
    console.log(`  ok=${result.ok} updated=${result.updated} totalTlds=${result.totalTlds} ${(result.durationMs/1000).toFixed(1)}s`)
    if (result.error) console.log(`  error: ${result.error.slice(0, 300)}`)

    if (!result.ok || result.updated === 0) {
      await db.update(registrars).set({ isActive: false }).where(eq(registrars.id, r.id))
      console.log("  → 恢复禁用")
    } else {
      console.log("  → 保持启用")
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`  异常: ${msg.slice(0, 300)}`)
    await db.update(registrars).set({ isActive: false }).where(eq(registrars.id, r.id))
    console.log("  → 恢复禁用")
  }
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
