import { db } from "@/lib/db"
import { registrars } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { startBackfill, runNextBatch, getBackfillState } from "@/services/crawl/backfill"

async function main() {
  const [netim] = await db.select().from(registrars).where(eq(registrars.slug, "netim")).limit(1)
  if (!netim) throw new Error("未找到 netim 注册商")

  // 启动回填（写入游标行，batchSize=50）
  await startBackfill(netim.id, 50)
  console.log("[v0] 回填已启动，执行第一批...")

  const res = await runNextBatch(netim.id, { force: true })
  console.log("[v0] 批次结果:", JSON.stringify(res))

  const state = await getBackfillState(netim.id)
  console.log(
    "[v0] 游标状态:",
    JSON.stringify({
      status: state?.status,
      cursor: state?.cursor,
      total: state?.total,
      batchesDone: state?.batchesDone,
      pricesUpdated: state?.pricesUpdated,
    }),
  )
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[v0] 失败:", e.message)
    console.error("[v0] 堆栈:", e.stack)
    process.exit(1)
  })
