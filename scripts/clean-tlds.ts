/**
 * TLD 数据清洗与热度标注
 *   1. 增量迁移:tlds 加 is_valid/popularity 列,建 exchange_rates 表
 *   2. 拉取 IANA 官方后缀列表,非官方后缀标记 is_valid=false(不再前台展示)
 *   3. 按热度表给常见后缀打分,重置 is_popular 标记
 *
 * 运行: npx tsx scripts/clean-tlds.ts
 */
import { sql } from "drizzle-orm"
import { db } from "../lib/db"
import { POPULARITY, POPULAR_FLAG_COUNT, popularTlds } from "../lib/tld-popularity"

/**
 * 传统通用顶级域(legacy gTLD,2012 年新顶级计划之前）。
 * 这些标记为 "gTLD"(通用);2 字母后缀标记为 "ccTLD"(国家);
 * 其余有效后缀一律为 "newG"(新顶级)。
 */
const LEGACY_GTLDS = new Set([
  "com", "net", "org", "info", "biz", "name", "pro", "mobi", "asia", "tel",
  "xxx", "cat", "jobs", "travel", "aero", "coop", "museum", "int", "gov",
  "edu", "mil", "arpa", "post",
])

/** 判定单个后缀的分类。tld 为主后缀(小写,如 "com"、"co"、"shop") */
function classify(tld: string): "gTLD" | "ccTLD" | "newG" {
  const base = tld.toLowerCase()
  // ICANN 规定:所有两字母顶级域专属国家/地区(ccTLD)
  if (/^[a-z]{2}$/.test(base)) return "ccTLD"
  if (LEGACY_GTLDS.has(base)) return "gTLD"
  return "newG"
}

async function main() {
  // ---- 1. 增量迁移 ----
  await db.execute(sql`ALTER TABLE tlds ADD COLUMN IF NOT EXISTS is_valid BOOLEAN NOT NULL DEFAULT true`)
  await db.execute(sql`ALTER TABLE tlds ADD COLUMN IF NOT EXISTS popularity INTEGER NOT NULL DEFAULT 0`)
  await db.execute(sql`CREATE TABLE IF NOT EXISTS exchange_rates (
    id SERIAL PRIMARY KEY,
    base TEXT NOT NULL DEFAULT 'USD',
    rates JSONB NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    next_update_at TIMESTAMPTZ
  )`)
  console.log("[1/3] 迁移完成")

  // ---- 2. IANA 校验 ----
  const res = await fetch("https://data.iana.org/TLD/tlds-alpha-by-domain.txt")
  if (!res.ok) throw new Error(`IANA 列表拉取失败: HTTP ${res.status}`)
  const text = await res.text()
  const ianaSet = new Set(
    text
      .split("\n")
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => l.trim().toLowerCase()),
  )
  console.log(`IANA 官方后缀数: ${ianaSet.size}`)

  const all: { id: number; tld: string }[] = (
    await db.execute(sql`SELECT id, tld FROM tlds`)
  ).rows as never[]

  const invalidIds: number[] = []
  for (const row of all) {
    // 数据库存的是主后缀(如 "com"、"co.uk")。多级后缀取最后一段校验
    const last = row.tld.split(".").pop() ?? row.tld
    if (!ianaSet.has(last.toLowerCase())) invalidIds.push(row.id)
  }
  if (invalidIds.length > 0) {
    await db.execute(
      sql`UPDATE tlds SET is_valid = false WHERE id IN (${sql.join(
        invalidIds.map((i) => sql`${i}`),
        sql`, `,
      )})`,
    )
  }
  // 同时把有效的恢复(幂等)
  await db.execute(
    sql`UPDATE tlds SET is_valid = true WHERE is_valid = false AND id NOT IN (${
      invalidIds.length > 0
        ? sql.join(invalidIds.map((i) => sql`${i}`), sql`, `)
        : sql`-1`
    })`,
  )
  console.log(`[2/3] 清洗完成: ${all.length} 个后缀中 ${invalidIds.length} 个非 IANA 后缀已隐藏`)

  // ---- 3. 热度打分 ----
  await db.execute(sql`UPDATE tlds SET popularity = 0, is_popular = false`)
  const entries = Object.entries(POPULARITY)
  for (const [tld, score] of entries) {
    await db.execute(sql`UPDATE tlds SET popularity = ${score} WHERE tld = ${tld}`)
  }
  const popularTldsList = popularTlds()
  await db.execute(
    sql`UPDATE tlds SET is_popular = true WHERE tld IN (${sql.join(
      popularTldsList.map((t) => sql`${t}`),
      sql`, `,
    )}) AND is_valid = true`,
  )
  console.log(`[3/4] 热度标注完成: ${entries.length} 个后缀已打分,前 ${POPULAR_FLAG_COUNT} 个设为热门`)

  // ---- 4. 精确三分类:通用 / 国家 / 新顶级 ----
  const byType: Record<"gTLD" | "ccTLD" | "newG", number[]> = { gTLD: [], ccTLD: [], newG: [] }
  for (const row of all) {
    if (invalidIds.includes(row.id)) continue // 无效后缀不重标
    const main = row.tld.split(".").pop() ?? row.tld
    byType[classify(main)].push(row.id)
  }
  for (const [type, ids] of Object.entries(byType)) {
    if (ids.length === 0) continue
    await db.execute(
      sql`UPDATE tlds SET type = ${type} WHERE id IN (${sql.join(
        ids.map((i) => sql`${i}`),
        sql`, `,
      )})`,
    )
  }
  console.log(
    `[4/4] 分类完成: 通用 ${byType.gTLD.length} · 国家 ${byType.ccTLD.length} · 新顶级 ${byType.newG.length}`,
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
