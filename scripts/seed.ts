// 种子脚本：将 lib/crawler/seed-data.ts 中的价格写入数据库，
// 并生成少量历史价格与示例采集任务/日志。
import { Pool } from "pg"
import { SEED_PRICES, SEED_SOURCE_URLS } from "../lib/crawler/seed-data"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const { rows: registrars } = await pool.query("SELECT id, slug FROM registrars")
  const { rows: tlds } = await pool.query("SELECT id, tld FROM tlds")
  const regBySlug = new Map<string, number>(registrars.map((r) => [r.slug, r.id]))
  const tldByName = new Map<string, number>(tlds.map((t) => [t.tld, t.id]))

  let count = 0
  for (const [slug, tldPrices] of Object.entries(SEED_PRICES)) {
    const registrarId = regBySlug.get(slug)
    if (!registrarId) continue
    const sourceUrl = SEED_SOURCE_URLS[slug] ?? null
    for (const [tld, [reg, renew, transfer]] of Object.entries(tldPrices)) {
      const tldId = tldByName.get(tld)
      if (!tldId) continue
      await pool.query(
        `INSERT INTO prices (registrar_id, tld_id, register_price, renew_price, transfer_price, currency, source_url, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'USD', $6, now())
         ON CONFLICT (registrar_id, tld_id) DO UPDATE SET
           register_price = EXCLUDED.register_price,
           renew_price = EXCLUDED.renew_price,
           transfer_price = EXCLUDED.transfer_price,
           source_url = EXCLUDED.source_url,
           updated_at = now()`,
        [registrarId, tldId, reg, renew, transfer, sourceUrl],
      )
      // 历史价格：30 天前记录一条（略高 3%），为价格趋势打基础
      await pool.query(
        `INSERT INTO price_history (registrar_id, tld_id, register_price, renew_price, transfer_price, currency, recorded_at)
         VALUES ($1, $2, $3, $4, $5, 'USD', now() - interval '30 days')`,
        [
          registrarId,
          tldId,
          reg == null ? null : Math.round(reg * 1.03 * 100) / 100,
          renew == null ? null : Math.round(renew * 1.03 * 100) / 100,
          transfer,
        ],
      )
      count++
    }
  }

  // 示例采集任务与日志
  for (const slug of ["cloudflare", "porkbun", "namecheap"]) {
    const registrarId = regBySlug.get(slug)
    if (!registrarId) continue
    const updated = Object.keys(SEED_PRICES[slug] ?? {}).length
    const { rows } = await pool.query(
      `INSERT INTO crawl_jobs (registrar_id, status, trigger, started_at, finished_at, prices_updated, created_at)
       VALUES ($1, 'success', 'scheduled', now() - interval '1 day', now() - interval '1 day' + interval '42 seconds', $2, now() - interval '1 day')
       RETURNING id`,
      [registrarId, updated],
    )
    const jobId = rows[0].id
    await pool.query(
      `INSERT INTO crawl_logs (job_id, level, message, created_at) VALUES
       ($1, 'info', '开始采集价格数据', now() - interval '1 day'),
       ($1, 'info', '成功获取 ' || $2 || ' 个后缀的价格', now() - interval '1 day' + interval '40 seconds'),
       ($1, 'info', '采集完成，共更新 ' || $2 || ' 条价格记录', now() - interval '1 day' + interval '42 seconds')`,
      [jobId, updated],
    )
  }

  console.log(`[v0] 种子完成：写入 ${count} 条价格记录`)
  await pool.end()
}

main().catch((err) => {
  console.error("[v0] 种子失败：", err)
  process.exit(1)
})
