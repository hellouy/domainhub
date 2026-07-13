/**
 * 浏览器捕获导入器
 * -----------------
 * 读取 /tmp/cap_<slug>.json（由 agent-browser 提取的 [{tld,register,renew,transfer}]），
 * 走标准 SDK 管道（normalize → validate → save）入库，策略记为 "playwright"。
 *
 * 用法: npx tsx scripts/import-capture.ts <slug> <currency> [sourceUrl]
 */
import { readFileSync } from "node:fs"
import { validatePrices } from "../packages/adapter-sdk/validation"
import type { NormalizedPrice } from "../packages/adapter-sdk/types"
import { createPriceSink } from "../packages/storage"
import { db } from "../lib/db"
import { registrars, crawlJobs, crawlLogs } from "../lib/db/schema"
import { eq, sql } from "drizzle-orm"

async function main() {
  const [slug, currency = "USD", sourceUrl = ""] = process.argv.slice(2)
  if (!slug) {
    console.error("用法: npx tsx scripts/import-capture.ts <slug> <currency> [sourceUrl]")
    process.exit(1)
  }

  const raw = JSON.parse(readFileSync(`/tmp/cap_${slug}.json`, "utf-8")) as Array<{
    tld: string
    register: number | null
    renew: number | null
    transfer: number | null
  }>

  const [reg] = await db.select().from(registrars).where(eq(registrars.slug, slug))
  if (!reg) {
    console.error(`注册商 ${slug} 不存在`)
    process.exit(1)
  }

  const collectedAt = new Date().toISOString()
  const normalized: NormalizedPrice[] = raw
    .filter((r) => r.tld && (r.register !== null || r.renew !== null))
    .map((r) => ({
      registrar: slug,
      tld: r.tld.toLowerCase().replace(/^\./, ""),
      currency,
      registerPrice: r.register,
      renewPrice: r.renew,
      transferPrice: r.transfer,
      restorePrice: null,
      premium: false,
      promotion: false,
      promoCode: null,
      region: null,
      billingPeriod: "1y",
      source: "浏览器捕获",
      sourceUrl,
      strategy: "playwright" as const,
      adapterVersion: "capture-1.0.0",
      parserVersion: "capture-1.0.0",
      collectedAt,
    }))

  const { sink } = await createPriceSink(reg.id)
  const validated = validatePrices(normalized, currency, sink.lookupExisting)
  const accepted = validated.filter((v) => v.status !== "rejected")
  const rejected = validated.length - accepted.length
  const stats = await sink.save(accepted)

  // 记录采集任务（与 SDK 服务一致的审计口径）
  const [job] = await db
    .insert(crawlJobs)
    .values({
      registrarId: reg.id,
      status: "completed",
      totalTlds: accepted.length,
      pricesUpdated: stats.inserted + stats.updated,
      strategy: "playwright",
      metrics: { rows: normalized.length, inserted: stats.inserted, updated: stats.updated, skipped: stats.skipped, rejected },
      finishedAt: new Date(),
    })
    .returning({ id: crawlJobs.id })
  await db.insert(crawlLogs).values({
    jobId: job.id,
    level: "info",
    message: `浏览器捕获导入: ${accepted.length} 条通过, ${rejected} 条拒绝, 新增 ${stats.inserted}, 更新 ${stats.updated}`,
  })

  // 更新健康快照
  await db
    .update(registrars)
    .set({
      health: sql`${JSON.stringify({
        score: 90,
        coverage: 1,
        successRate: 1,
        failureRate: 0,
        avgLatencyMs: 0,
        lastSuccessAt: collectedAt,
        currentStrategy: "playwright",
      })}::jsonb`,
      adapterVersion: "capture-1.0.0",
    })
    .where(eq(registrars.id, reg.id))

  console.log(
    `${slug}: 输入 ${raw.length}, 通过 ${accepted.length}, 拒绝 ${rejected}, 新增 ${stats.inserted}, 更新 ${stats.updated}, 跳过 ${stats.skipped}`,
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
