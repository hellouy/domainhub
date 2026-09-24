/**
 * 自动入库 watcher —— 数据库恢复后自动把采集明细灌入库
 * ------------------------------------------------------------
 * 逻辑：
 * 1. 读 data/prices-YYYYMMDD.json 最新明细（本地落盘，不依赖数据库）。
 * 2. 循环探测 DATABASE_URL：每 8s 尝试连接 + SELECT 1，失败继续等待。
 * 3. 连接成功后停止轮询，执行幂等三表灌库：
 *    - registrars：slug 冲突则跳过（DO NOTHING），不覆盖已有品牌数据
 *    - tlds      ：tld 冲突则跳过，只补缺失后缀
 *    - prices    ：(registrar_id, tld_id) 冲突则 DO UPDATE 刷新价格
 *    - crawl_jobs：追加一条完成记录（source=auto-sync）
 * 4. 写 data/sync-meta.json（lastSyncAt + 各家条数），打印统计后退出。
 *
 * 任何 Postgres 系数据库都适用（改 DATABASE_URL 即可）：Neon 恢复、
 * Supabase、本地 PG 均可直接注入，无需改代码。
 *
 * 运行：npx tsx scripts/auto-sync-prices.ts
 */
import { Pool } from "pg"
import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

interface PriceRow {
  tld: string
  currency: string
  registerPrice: number | null
  renewPrice: number | null
  transferPrice: number | null
}

interface RegistrarDoc {
  name: string
  website: string
  currency: string
  strategy: string
  collectedAt: string
  prices: PriceRow[]
}

interface SyncMeta {
  lastSyncAt: string | null
  lastSyncFile: string | null
  attempts: number
}

const DATA_DIR = join(process.cwd(), "data")
const META_FILE = join(DATA_DIR, "sync-meta.json")
const INTERVAL_MS = 8000
const CONNECT_TIMEOUT_MS = 12_000

function latestPriceFile(): { file: string; data: { collectedAt: string; registrars: Record<string, RegistrarDoc> } } | null {
  const files = readdirSync(DATA_DIR)
    .filter((f) => /^prices-\d{8}\.json$/.test(f))
    .sort()
  if (files.length === 0) return null
  const file = files[files.length - 1]
  const data = JSON.parse(readFileSync(join(DATA_DIR, file), "utf8"))
  return { file, data }
}

function readMeta(): SyncMeta {
  try {
    return JSON.parse(readFileSync(META_FILE, "utf8"))
  } catch {
    return { lastSyncAt: null, lastSyncFile: null, attempts: 0 }
  }
}

function writeMeta(meta: SyncMeta) {
  writeFileSync(META_FILE, JSON.stringify(meta, null, 2))
}

async function probe(pool: Pool): Promise<boolean> {
  try {
    const client = await pool.connect()
    try {
      await client.query("SELECT 1")
      return true
    } finally {
      client.release()
    }
  } catch {
    return false
  }
}

const N = (v: number | null) => (v === null ? null : String(v))

async function sync(pool: Pool, doc: { collectedAt: string; registrars: Record<string, RegistrarDoc> }) {
  const client = await pool.connect()
  try {
    // 1. registrars：slug 缺失才插入（品牌既有记录不触碰）
    const registrarIds = new Map<string, number>()
    const registrarNames = new Map<string, string>()
    for (const [slug, r] of Object.entries(doc.registrars)) {
      const host = new URL(r.website).host
      const res = await client.query(
        `INSERT INTO registrars (slug, name, website, description, is_active)
         VALUES ($1, $2, $3, '今日采集自动入库', true)
         ON CONFLICT (slug) DO NOTHING
         RETURNING id, slug, name`,
        [slug, r.name, host],
      )
      if (res.rows.length === 0) {
        const { rows } = await client.query(`SELECT id, name FROM registrars WHERE slug = $1`, [slug])
        registrarIds.set(slug, rows[0].id)
        registrarNames.set(slug, rows[0].name)
      } else {
        registrarIds.set(slug, res.rows[0].id)
        registrarNames.set(slug, res.rows[0].name)
      }
    }

    // 2. tlds：tld 缺失才插入
    const tldIds = new Map<string, number>()
    for (const [slug, r] of Object.entries(doc.registrars)) {
      for (const p of r.prices) {
        const tld = p.tld.toLowerCase()
        if (tldIds.has(tld)) continue
        const res = await client.query(
          `INSERT INTO tlds (tld, type, is_valid)
           VALUES ($1, 'gTLD', true)
           ON CONFLICT (tld) DO NOTHING
           RETURNING id`,
          [tld],
        )
        if (res.rows.length === 0) {
          const { rows } = await client.query(`SELECT id FROM tlds WHERE tld = $1`, [tld])
          tldIds.set(tld, rows[0].id)
        } else {
          tldIds.set(tld, res.rows[0].id)
        }
      }
    }

    // 3. prices：(registrar_id, tld_id) 冲突则刷新
    let inserted = 0
    let updated = 0
    for (const [slug, r] of Object.entries(doc.registrars)) {
      const rid = registrarIds.get(slug)!
      for (const p of r.prices) {
        const tid = tldIds.get(p.tld.toLowerCase())
        if (tid === undefined) continue
        const res = await client.query(
          `INSERT INTO prices (registrar_id, tld_id, register_price, renew_price, transfer_price, currency, source_url, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, now())
           ON CONFLICT (registrar_id, tld_id) DO UPDATE SET
             register_price = EXCLUDED.register_price,
             renew_price = EXCLUDED.renew_price,
             transfer_price = EXCLUDED.transfer_price,
             currency = EXCLUDED.currency,
             source_url = EXCLUDED.source_url,
             updated_at = now()
           RETURNING (xmax = 0) AS is_insert`,
          [rid, tid, N(p.registerPrice), N(p.renewPrice), N(p.transferPrice), p.currency, r.website],
        )
        if (res.rows[0].is_insert) inserted++ 
        else updated++
      }
    }

    // 4. crawl_jobs 记录
    let total = 0
    for (const r of Object.values(doc.registrars)) total += r.prices.length
    await client.query(
      `INSERT INTO crawl_jobs (registrar_id, status, trigger, started_at, finished_at, prices_updated, total_tlds, created_at)
       VALUES (NULL::int, 'completed', 'manual', now(), now(), $1, $2, now())`,
      [inserted + updated, total],
    )

    console.log(`\\n入库完成: inserted=${inserted} updated=${updated} total=${total}`)
    console.log(`registrars=${registrarIds.size} tlds=${tldIds.size}`)
    for (const [slug, id] of registrarIds) {
      console.log(`  ${slug.padEnd(18)} #${id}  ${registrarNames.get(slug)}`)
    }
  } finally {
    client.release()
  }
}

async function main() {
  try {
    process.loadEnvFile(join(process.cwd(), ".env.local"))
  } catch {
    /* 无 .env.local 时使用已有环境变量 */
  }
  const meta = readMeta()
  const source = latestPriceFile()
  if (!source) {
    console.error("未找到 data/prices-*.json，先运行 scripts/export-prices.ts")
    process.exit(1)
  }
  console.log(`明细: ${source.file}（${Object.keys(source.data.registrars).length} 家）`)

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: CONNECT_TIMEOUT_MS })
  pool.on("error", () => {})

  process.on("SIGINT", () => {
    writeMeta(meta)
    process.exit(0)
  })

  for (let i = 1; ; i++) {
    meta.attempts = i
    if (await probe(pool)) {
      console.log(`第 ${i} 次探测成功，开始灌库…`)
      await sync(pool, source.data)
      meta.lastSyncAt = new Date().toISOString()
      meta.lastSyncFile = source.file
      writeMeta(meta)
      break
    }
    if (i === 1) console.error(`数据库不可用（配额耗尽或未配置），每 ${INTERVAL_MS / 1000}s 自动重试；回复后首个成功探测即灌库…`)
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
  }
  await pool.end()
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})