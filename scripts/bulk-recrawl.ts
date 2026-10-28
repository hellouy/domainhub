/**
 * 全量重爬脚本 — 遍历所有活跃注册商,逐个调用 runCrawlJob 更新数据
 * 用法: npx tsx scripts/bulk-recrawl.ts
 */
import { db } from "@/lib/db"
import { registrars } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { runCrawlJob } from "@/lib/crawler/runner"

async function main() {
  console.log("开始全量重爬...")
  
  const active = await db.select().from(registrars).where(eq(registrars.isActive, true))
  console.log(`共 ${active.length} 家活跃注册商待爬`)
  
  let success = 0, failed = 0
  const start = Date.now()
  
  for (let i = 0; i < active.length; i++) {
    const r = active[i]
    const t0 = Date.now()
    try {
      const res = await runCrawlJob(r.id)
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
      if (res.ok) {
        console.log(`[${i+1}/${active.length}] ${r.slug} — ok=${res.ok} updated=${res.updated} totalTlds=${res.totalTlds} (${elapsed}s)`)
        success++
      } else {
        console.log(`[${i+1}/${active.length}] ${r.slug} — FAIL: ${res.error?.slice(0, 80) ?? "unknown"} (${elapsed}s)`)
        failed++
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`[${i+1}/${active.length}] ${r.slug} — EXCEPTION: ${msg.slice(0, 80)}`)
      failed++
    }
  }
  
  const total = ((Date.now() - start) / 1000).toFixed(0)
  console.log(`\n完成: 成功 ${success} 家, 失败 ${failed} 家, 总耗时 ${total}s`)
}

main().catch(console.error).finally(() => process.exit(0))
