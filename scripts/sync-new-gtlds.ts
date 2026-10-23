/**
 * 新顶级（newG）申请数据同步 —— ICANN Next Round Application Portal (APS)
 * ------------------------------------------------------------
 * 数据源：https://newgtldprogram-aps.icann.org/aps/applications （公开 REST，无需登录）
 * 逻辑：
 *   1. 分页拉取全部申请（每页 100，约 28 页）。
 *   2. 仅保留 applicationStatus=Active 且非 Brand（单注册人品牌后缀不对公众开放注册）。
 *   3. 以展示串去重（IDN 用 uLabel，ASCII 用 aLabel）。
 *   4. 跳过已在 IANA 委派的后缀（这些属于「已开放 → 通用」，不属新顶级）。
 *   5. 幂等写入 tlds：type='newG'，附带申请机构、状态、类别、来源；仅更新已有 newG 行，
 *      绝不覆盖 gTLD/ccTLD。
 *
 * 说明：ICANN 尚未公布 2026 轮各申请的委派/开放日期，launch_date 暂为 NULL（前台显示「待定」），
 *      后续公布后重新运行本脚本即可回填。
 *
 * 运行：npx tsx scripts/sync-new-gtlds.ts
 */
import { join } from "node:path"
import { sql } from "drizzle-orm"
import { domainToASCII } from "node:url"
import { db, pool } from "../lib/db"

const APS_URL = "https://newgtldprogram-aps.icann.org/aps/applications"
const PAGE_SIZE = 100
const PAGE_DELAY_MS = 300
const SOURCE_URL = "https://newgtldprogram.icann.org/en/application-rounds/round2"

type ApsApp = {
  applicationHumanReadableId: string
  primaryString: { aLabel?: string; uLabel?: string } | null
  organizationName?: string | null
  applicationStatus?: string | null
  processingStage?: string | null
  tldTypes?: string[] | null
}

type Row = {
  tld: string
  launchStatus: string
  launchType: string
  applicant: string
}

function mapStatus(stage?: string | null): string {
  const s = (stage ?? "").toLowerCase()
  if (s.includes("contract")) return "contracted"
  if (s.includes("delegat") || s.includes("launch")) return "launching"
  if (s.includes("evaluat")) return "evaluating"
  return "applied"
}

function mapType(types: string[]): string {
  if (types.includes("IDN")) return "idn"
  if (types.some((t) => t.toLowerCase().includes("geo"))) return "geo"
  if (types.includes("Community")) return "community"
  return "general"
}

async function fetchPage(pageNum: number): Promise<{ items: ApsApp[]; total: number }> {
  const res = await fetch(APS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({
      searchAndFilter: {},
      sort: { field: "applicationId", direction: "ASC" },
      pagination: { pageSize: PAGE_SIZE, pageNum, totalItems: 0 },
    }),
  })
  if (!res.ok) throw new Error(`APS 请求失败: HTTP ${res.status} (page ${pageNum})`)
  const data = (await res.json()) as { applications?: ApsApp[]; totalApplications?: number }
  return { items: data.applications ?? [], total: data.totalApplications ?? 0 }
}

async function fetchAll(): Promise<ApsApp[]> {
  const first = await fetchPage(0)
  const total = first.total
  const pages = Math.ceil(total / PAGE_SIZE)
  const all = [...first.items]
  for (let p = 1; p < pages; p++) {
    await new Promise((r) => setTimeout(r, PAGE_DELAY_MS))
    const { items } = await fetchPage(p)
    all.push(...items)
    if (items.length > 0) console.log(`fetched ${all.length}/${total}`)
  }
  return all
}

/** 把申请列表聚合成去重后的 newG 行。 */
function buildRows(apps: ApsApp[], iana: Set<string>): Row[] {
  const byTld = new Map<string, Row>()
  for (const a of apps) {
    if (a.applicationStatus !== "Active") continue
    const types = a.tldTypes ?? []
    if (types.includes("Brand")) continue // 品牌后缀不对公众开放注册

    const p = a.primaryString ?? {}
    const disp = (p.uLabel?.trim() || p.aLabel?.trim() || "").trim()
    if (!disp) continue

    const key = domainToASCII(disp) || disp
    if (iana.has(key.toLowerCase())) continue // 已委派 → 已在通用，跳过

    const tld = disp.toLowerCase()
    if (byTld.has(tld)) continue
    byTld.set(tld, {
      tld,
      launchStatus: mapStatus(a.processingStage),
      launchType: mapType(types),
      applicant: a.organizationName?.trim() || "",
    })
  }
  return [...byTld.values()]
}

async function ensureColumns() {
  await db.execute(sql`ALTER TABLE tlds ADD COLUMN IF NOT EXISTS launch_status TEXT`)
  await db.execute(sql`ALTER TABLE tlds ADD COLUMN IF NOT EXISTS launch_date TIMESTAMPTZ`)
  await db.execute(sql`ALTER TABLE tlds ADD COLUMN IF NOT EXISTS launch_type TEXT`)
  await db.execute(sql`ALTER TABLE tlds ADD COLUMN IF NOT EXISTS applicant TEXT`)
  await db.execute(sql`ALTER TABLE tlds ADD COLUMN IF NOT EXISTS source_url TEXT`)
}

async function upsertRows(rows: Row[]) {
  let inserted = 0
  let updated = 0
  for (const r of rows) {
    const res = await db.execute(sql`
      INSERT INTO tlds (tld, type, is_valid, launch_status, launch_type, applicant, source_url)
      VALUES (${r.tld}, 'newG', true, ${r.launchStatus}, ${r.launchType}, ${r.applicant}, ${SOURCE_URL})
      ON CONFLICT (tld) DO UPDATE SET
        launch_status = EXCLUDED.launch_status,
        launch_type = EXCLUDED.launch_type,
        applicant = EXCLUDED.applicant,
        source_url = EXCLUDED.source_url,
        is_valid = true
      WHERE tlds.type = 'newG'
      RETURNING (xmax = 0) AS is_insert
    `)
    const row = res.rows[0] as { is_insert: boolean } | undefined
    if (!row) continue // 已存在且非 newG（gTLD/ccTLD），未覆盖
    if (row.is_insert) inserted++
    else updated++
  }
  return { inserted, updated }
}

async function main() {
  try {
    process.loadEnvFile(join(process.cwd(), ".env.local"))
  } catch {
    /* 允许直接提供环境变量 */
  }

  await ensureColumns()

  const ianaRes = await fetch("https://data.iana.org/TLD/tlds-alpha-by-domain.txt")
  if (!ianaRes.ok) throw new Error(`IANA 列表拉取失败: HTTP ${ianaRes.status}`)
  const iana = new Set(
    (await ianaRes.text())
      .split("\n")
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => l.trim().toLowerCase()),
  )

  const apps = await fetchAll()
  const rows = buildRows(apps, iana)
  console.log(`申请 ${apps.length} 条 → 非品牌活跃、未委派去重后 ${rows.length} 个新顶级后缀`)

  const { inserted, updated } = await upsertRows(rows)
  console.log(`入库完成: inserted=${inserted} updated=${updated}`)
  await pool.end()
  process.exit(0)
}

main().catch(async (e) => {
  console.error(e)
  await pool.end().catch(() => {})
  process.exit(1)
})
