/**
 * 浏览器类注册商本地补采 —— 对依赖 playwright 策略的注册商执行写库采集。
 * ---------------------------------------------------------------------
 * 用途: 生产 Vercel cron 环境无 BROWSER_SERVICE_URL(playwright 渲染服务),
 * 依赖 playwright 的注册商(20 家)在生产无法采集。本脚本在本机跑,
 * 使用本地常驻 browser-worker(8841) 补采这批注册商, 确保其价格自动更新。
 *
 * 运行:
 *   BROWSER_SERVICE_URL=http://127.0.0.1:8841 \
 *   BROWSER_SERVICE_TOKEN=<token> \
 *   DATABASE_URL=<drizzle url> \
 *   npx tsx scripts/recrawl-browser-registrars.ts          # 20 家 playwright 注册商
 *   npx tsx scripts/recrawl-browser-registrars.ts --all    # 全部活跃注册商
 *   npx tsx scripts/recrawl-browser-registrars.ts <slug...> # 指定注册商
 *
 * 建议: 通过 crontab 每日执行(本地 browser-worker 常驻)。
 */
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { prices, registrars } from "@/lib/db/schema"
import { getRegisteredAdapter, listRegisteredAdapters } from "@/packages/registry"
import "@/adapters"
import { runCrawlWithSdk } from "@/services/crawl"

async function main() {
  const args = process.argv.slice(2)
  const all = args.includes("--all")
  const onlyRaw = all ? undefined : args.filter(a => !a.startsWith("--"))
  const only = onlyRaw && onlyRaw.length > 0 ? onlyRaw : undefined

  const regs = await db.select().from(registrars).where(eq(registrars.isActive, true))
  const bySlug = new Map(regs.map(r => [r.slug, r]))

  let targets: Array<{ slug: string; id: number }> = []
  if (only) {
    // 指定 slug: 精确采集(无论策略类型)
    for (const slug of only) {
      const r = bySlug.get(slug)
      if (r) targets.push({ slug, id: r.id })
    }
  } else {
    for (const a of listRegisteredAdapters()) {
      const r = bySlug.get(a.slug)
      if (!r) continue
      const types = a.definition.strategies.map(s => s.type)
      if (all ? true : types.includes("playwright")) {
        targets.push({ slug: a.slug, id: r.id })
      }
    }
  }
  // 全量轮按"最久未更新优先"排序: 即便被外部队列/超时截断, 也能先补刷新最旧的注册商,
  // 避免顺序固定导致尾部注册商永远排不上更新。
  if (all && targets.length > 0) {
    const lastUpd = new Map<string, number>()
    const rows = await db
      .select({ slug: registrars.slug, lastUpd: prices.updatedAt })
      .from(registrars)
      .leftJoin(prices, and(eq(prices.registrarId, registrars.id), eq(registrars.isActive, true)))
      .where(eq(registrars.isActive, true))
    for (const row of rows) {
      const t = row.lastUpd?.getTime() ?? Number.POSITIVE_INFINITY
      const cur = lastUpd.get(row.slug)
      if (cur === undefined || t > cur) lastUpd.set(row.slug, t)
    }
    targets.sort((a, b) => (lastUpd.get(a.slug) ?? Number.POSITIVE_INFINITY) - (lastUpd.get(b.slug) ?? Number.POSITIVE_INFINITY))
  }
  if (targets.length === 0) {
    console.log("没有匹配的注册商")
    process.exit(1)
  }
  console.log(`待采集 ${targets.length} 家: ${targets.map(t => t.slug).join(", ")}\n`)

  let ok = 0
  const failed: Array<{ slug: string; err: string }> = []
  for (const t of targets) {
    const s = Date.now()
    try {
      const res = await runCrawlWithSdk(t.id, { trigger: "local-sync" })
      const success = res?.ok ?? false
      if (success) ok++
      else failed.push({ slug: t.slug, err: res?.error ?? "unknown" })
      console.log(`${success ? "OK  " : "FAIL"} ${t.slug.padEnd(16)} tlds=${String(res?.totalTlds ?? 0).padStart(4)} upd=${String(res?.updated ?? 0).padStart(4)} ${((Date.now() - s) / 1000).toFixed(1)}s ${res?.error ?? ""}`)
    } catch (e: any) {
      failed.push({ slug: t.slug, err: e.message })
      console.log(`FAIL ${t.slug.padEnd(16)} ${((Date.now() - s) / 1000).toFixed(1)}s ${e.message.slice(0, 100)}`)
    }
  }
  console.log(`\n完成 ${targets.length} 家，成功 ${ok}，失败 ${failed.length}`)
  for (const f of failed) console.log(`  FAILED: ${f.slug} — ${f.err.slice(0, 80)}`)
}
main().catch(e => { console.error(e); process.exit(1) })
