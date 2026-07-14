/**
 * Neon → Supabase 单向复制
 * ------------------------------------------------------------
 * 方向严格单向：主库(Neon) → 备库(Supabase)。备库只读，绝不反向写回。
 * 凭证/队列/日志等运维表不复制（安全 + 无意义）。
 *
 * 复制策略：
 * - 业务主数据表：全量替换（DELETE + INSERT），保证副本与主库精确一致（含删除）。
 * - price_history：追加式增量（按 id > 副本最大 id），因其只增不改、体量可能较大。
 *
 * 序列化：用 Postgres json_populate_recordset 从主库 SELECT 出的行对象直接展开，
 * 自动正确处理 jsonb / text[] / timestamptz / numeric 等所有列类型。
 */
import { pool, replicaPoolRaw, hasReplica } from "@/lib/db"
import type { PoolClient } from "pg"

/** 全量替换的表（顺序无强依赖，因无声明式外键约束） */
const FULL_REPLACE_TABLES = [
  "registrars",
  "tlds",
  "exchange_rates",
  "prices",
  "crawl_jobs",
  "adapter_rules",
  "registrar_capabilities",
  "discovery_metadata",
  "site_settings",
] as const

/** 追加式增量的表 */
const APPEND_TABLES = ["price_history"] as const

export interface ReplicationResult {
  ok: boolean
  mode: "full"
  durationMs: number
  tables: Record<string, number>
  error?: string
}

/** 全量替换单表：DELETE 后用 json_populate_recordset 灌入主库当前全量 */
async function fullReplace(client: PoolClient, table: string): Promise<number> {
  const { rows } = await pool.query(`SELECT * FROM ${table}`)
  await client.query(`DELETE FROM ${table}`)
  if (rows.length > 0) {
    await client.query(
      `INSERT INTO ${table} SELECT * FROM json_populate_recordset(null::${table}, $1::json)`,
      [JSON.stringify(rows)],
    )
  }
  return rows.length
}

/** 追加式增量单表：仅复制副本尚未有的新行（按 id） */
async function appendIncremental(table: string): Promise<number> {
  const replica = replicaPoolRaw!
  const { rows: maxRows } = await replica.query(`SELECT COALESCE(MAX(id), 0)::int AS max FROM ${table}`)
  const sinceId = maxRows[0]?.max ?? 0
  const { rows } = await pool.query(`SELECT * FROM ${table} WHERE id > $1 ORDER BY id`, [sinceId])
  if (rows.length > 0) {
    await replica.query(
      `INSERT INTO ${table} SELECT * FROM json_populate_recordset(null::${table}, $1::json)`,
      [JSON.stringify(rows)],
    )
  }
  return rows.length
}

/** 执行一次完整同步；未配置备库时直接返回 skipped */
export async function runReplication(): Promise<ReplicationResult> {
  const started = Date.now()
  if (!hasReplica || !replicaPoolRaw) {
    return { ok: false, mode: "full", durationMs: 0, tables: {}, error: "未配置 REPLICA_DATABASE_URL，跳过复制" }
  }

  const tables: Record<string, number> = {}
  try {
    // 全量替换表放在一个事务里，保证副本一致性快照
    const client = await replicaPoolRaw.connect()
    try {
      await client.query("BEGIN")
      for (const t of FULL_REPLACE_TABLES) {
        tables[t] = await fullReplace(client, t)
      }
      await client.query("COMMIT")
    } catch (err) {
      await client.query("ROLLBACK")
      throw err
    } finally {
      client.release()
    }

    // 追加式增量表（事务外，幂等）
    for (const t of APPEND_TABLES) {
      tables[t] = await appendIncremental(t)
    }

    const durationMs = Date.now() - started
    await recordState({ ok: true, mode: "full", durationMs, tables })
    return { ok: true, mode: "full", durationMs, tables }
  } catch (err) {
    const durationMs = Date.now() - started
    const message = err instanceof Error ? err.message : String(err)
    await recordState({ ok: false, mode: "full", durationMs, tables, error: message })
    return { ok: false, mode: "full", durationMs, tables, error: message }
  }
}

/** 把最近一次同步结果写入主库 replication_state（best-effort） */
async function recordState(result: ReplicationResult): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO replication_state (id, last_sync_at, last_result, last_error, updated_at)
       VALUES (1, $1, $2::jsonb, $3, now())
       ON CONFLICT (id) DO UPDATE SET
         last_sync_at = CASE WHEN $4 THEN EXCLUDED.last_sync_at ELSE replication_state.last_sync_at END,
         last_result = EXCLUDED.last_result,
         last_error = EXCLUDED.last_error,
         updated_at = now()`,
      [
        result.ok ? new Date().toISOString() : null,
        JSON.stringify({ tables: result.tables, durationMs: result.durationMs, mode: result.mode }),
        result.error ?? null,
        result.ok,
      ],
    )
  } catch (err) {
    console.log("[v0] 记录复制状态失败（不影响主流程）：", (err as Error).message)
  }
}

export interface ReplicationStatus {
  configured: boolean
  lastSyncAt: string | null
  lastError: string | null
  lastResult: { tables?: Record<string, number>; durationMs?: number } | null
  /** 各表主/备行数对比（备库不可达时 replica 为 null） */
  counts: Array<{ table: string; primary: number; replica: number | null }>
}

/** 供后台展示：最近同步时间 + 各表主备行数差 */
export async function getReplicationStatus(): Promise<ReplicationStatus> {
  const allTables = [...FULL_REPLACE_TABLES, ...APPEND_TABLES]

  let lastSyncAt: string | null = null
  let lastError: string | null = null
  let lastResult: ReplicationStatus["lastResult"] = null
  try {
    const { rows } = await pool.query(
      `SELECT last_sync_at, last_error, last_result FROM replication_state WHERE id = 1`,
    )
    if (rows[0]) {
      lastSyncAt = rows[0].last_sync_at ? new Date(rows[0].last_sync_at).toISOString() : null
      lastError = rows[0].last_error ?? null
      lastResult = rows[0].last_result ?? null
    }
  } catch {
    /* replication_state 尚未建表时忽略 */
  }

  const counts: ReplicationStatus["counts"] = []
  for (const t of allTables) {
    let primaryCount = 0
    let replicaCount: number | null = null
    try {
      const r = await pool.query(`SELECT count(*)::int AS c FROM ${t}`)
      primaryCount = r.rows[0]?.c ?? 0
    } catch {
      /* ignore */
    }
    if (hasReplica && replicaPoolRaw) {
      try {
        const r = await replicaPoolRaw.query(`SELECT count(*)::int AS c FROM ${t}`)
        replicaCount = r.rows[0]?.c ?? 0
      } catch {
        replicaCount = null
      }
    }
    counts.push({ table: t, primary: primaryCount, replica: replicaCount })
  }

  return { configured: hasReplica, lastSyncAt, lastError, lastResult, counts }
}
