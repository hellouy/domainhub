/**
 * 一次性脚本：对生产库执行一次真实的 Netim 采集（写库）。
 * 用后即删。通过环境变量注入生产 DATABASE_URL / CREDENTIAL_ENCRYPTION_KEY。
 */
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { registrars } from "@/lib/db/schema"
import { runCrawlWithSdk } from "@/services/crawl"

async function main() {
  const [reg] = await db.select().from(registrars).where(eq(registrars.slug, "netim"))
  if (!reg) throw new Error("生产库中未找到 netim 注册商")
  console.log(`[v0] 开始对生产库执行 Netim(id=${reg.id}) 真实采集…`)
  const t0 = Date.now()
  const result = await runCrawlWithSdk(reg.id)
  console.log(`[v0] 采集结束，用时 ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  console.log("[v0] 结果:", JSON.stringify(result, null, 2))
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[v0] 失败:", e.message)
    console.error(e.stack)
    process.exit(1)
  })
