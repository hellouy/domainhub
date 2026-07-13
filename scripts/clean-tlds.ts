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

/** 热度分表:分值越大越靠前。前 24 个标记为 isPopular(首页"热门"标签) */
const POPULARITY: Record<string, number> = {
  // 顶级热门(通用)
  com: 1000, net: 980, org: 970, io: 950, ai: 945, co: 930, app: 920, dev: 915,
  xyz: 910, me: 905, info: 900, cc: 895, tv: 890, online: 885, site: 880, top: 875,
  // 热门国别
  cn: 870, de: 865, uk: 860, us: 855, eu: 850, jp: 845, fr: 840, in: 835,
  // 常见通用/新顶级
  biz: 830, shop: 825, store: 820, tech: 815, vip: 810, club: 805, blog: 800,
  cloud: 795, space: 790, fun: 785, live: 780, life: 775, world: 770, today: 765,
  news: 760, pro: 755, one: 750, link: 745, email: 740, network: 735, digital: 730,
  agency: 725, studio: 720, design: 715, media: 710, group: 705, ltd: 700,
  page: 695, plus: 690, red: 685, run: 680, team: 675, work: 670, zone: 665,
  // 常见国别/技术圈
  ca: 660, au: 655, nl: 650, ru: 645, br: 640, es: 635, it: 630, ch: 625,
  se: 620, no: 615, nz: 610, kr: 605, hk: 600, tw: 595, sg: 590, be: 585,
  at: 580, pl: 575, pt: 570, fi: 565, dk: 560, ie: 555, cz: 550, mx: 545,
  gg: 540, so: 535, to: 530, ly: 525, sh: 520, im: 515, is: 510, la: 505,
  ml: 500, tk: 495, ga: 490, cf: 485, gq: 480, cx: 475, ws: 470, vc: 465,
  fm: 460, am: 455, name: 450, mobi: 445, asia: 440, wiki: 435, ink: 430,
}

const POPULAR_FLAG_COUNT = 24

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
  const popularTlds = entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, POPULAR_FLAG_COUNT)
    .map(([t]) => t)
  await db.execute(
    sql`UPDATE tlds SET is_popular = true WHERE tld IN (${sql.join(
      popularTlds.map((t) => sql`${t}`),
      sql`, `,
    )}) AND is_valid = true`,
  )
  console.log(`[3/3] 热度标注完成: ${entries.length} 个后缀已打分,前 ${POPULAR_FLAG_COUNT} 个设为热门`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
