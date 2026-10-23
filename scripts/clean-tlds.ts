/**
 * TLD 数据清洗与热度标注
 *   1. 增量迁移:tlds 加 is_valid/popularity/新顶级信息列,建 exchange_rates 表
 *   2. 拉取 IANA 官方后缀列表,非官方后缀标记 is_valid=false(不再前台展示)
 *   3. 按热度表给常见后缀打分,重置 is_popular 标记
 *   4. 精确二分类:通用(gTLD) / 国家(ccTLD)；新顶级(newG) 由 sync-new-gtlds 维护,此处跳过
 *
 * 运行: npx tsx scripts/clean-tlds.ts
 */
import { sql } from "drizzle-orm"
import { domainToASCII } from "node:url"
import { db } from "../lib/db"
import { POPULARITY, POPULAR_FLAG_COUNT, popularTlds } from "../lib/tld-popularity"
import { classifyDelegated, lastLabel } from "../lib/tld-classify"

/** 把末级标签转成 IANA 使用的 punycode（IDN 后缀需转码后再比对）。 */
function ianaKey(tld: string): string {
  const last = lastLabel(tld)
  try {
    return (domainToASCII(last) || last).toLowerCase()
  } catch {
    return last
  }
}

async function main() {
  // ---- 1. 增量迁移 ----
  await db.execute(sql`ALTER TABLE tlds ADD COLUMN IF NOT EXISTS is_valid BOOLEAN NOT NULL DEFAULT true`)
  await db.execute(sql`ALTER TABLE tlds ADD COLUMN IF NOT EXISTS popularity INTEGER NOT NULL DEFAULT 0`)
  await db.execute(sql`ALTER TABLE tlds ADD COLUMN IF NOT EXISTS launch_status TEXT`)
  await db.execute(sql`ALTER TABLE tlds ADD COLUMN IF NOT EXISTS launch_date TIMESTAMPTZ`)
  await db.execute(sql`ALTER TABLE tlds ADD COLUMN IF NOT EXISTS launch_type TEXT`)
  await db.execute(sql`ALTER TABLE tlds ADD COLUMN IF NOT EXISTS applicant TEXT`)
  await db.execute(sql`ALTER TABLE tlds ADD COLUMN IF NOT EXISTS source_url TEXT`)
  await db.execute(sql`CREATE TABLE IF NOT EXISTS exchange_rates (
    id SERIAL PRIMARY KEY,
    base TEXT NOT NULL DEFAULT 'USD',
    rates JSONB NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    next_update_at TIMESTAMPTZ
  )`)
  console.log("[1/4] 迁移完成")

  // ---- 2. IANA 校验（新顶级 newG 是尚未委派的申请,跳过）----
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

  const all: { id: number; tld: string; type: string }[] = (
    await db.execute(sql`SELECT id, tld, type FROM tlds`)
  ).rows as never[]

  const invalidIds: number[] = []
  const validDelegated: { id: number; tld: string }[] = []
  for (const row of all) {
    if (row.type === "newG") continue // 未委派申请,保留其 is_valid/type
    if (!ianaSet.has(ianaKey(row.tld))) invalidIds.push(row.id)
    else validDelegated.push(row) // 数据库存主后缀(如 com/co.uk),多级取最后一段比对
  }
  if (invalidIds.length > 0) {
    await db.execute(
      sql`UPDATE tlds SET is_valid = false WHERE id IN (${sql.join(
        invalidIds.map((i) => sql`${i}`),
        sql`, `,
      )})`,
    )
  }
  // 同时把有效的恢复(幂等，不含 newG)
  await db.execute(
    sql`UPDATE tlds SET is_valid = true WHERE is_valid = false AND type <> 'newG' AND id NOT IN (${
      invalidIds.length > 0
        ? sql.join(invalidIds.map((i) => sql`${i}`), sql`, `)
        : sql`-1`
    })`,
  )
  console.log(`[2/4] 清洗完成: ${all.length} 个后缀中 ${invalidIds.length} 个非 IANA 后缀已隐藏`)

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

  // ---- 4. 精确二分类:通用 / 国家（新顶级由 sync-new-gtlds 维护）----
  const byType: Record<"gTLD" | "ccTLD", number[]> = { gTLD: [], ccTLD: [] }
  for (const row of validDelegated) {
    byType[classifyDelegated(row.tld)].push(row.id)
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
    `[4/4] 分类完成: 通用 ${byType.gTLD.length} · 国家 ${byType.ccTLD.length}（新顶级见 sync-new-gtlds）`,
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
