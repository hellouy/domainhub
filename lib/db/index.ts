/**
 * DB 连接层 —— Neon 主 + Supabase 备（高可用故障切换）
 * ------------------------------------------------------------
 * 所有权：Platform Team
 * 文档：docs/db-portability.md
 *
 * 架构：
 * - 主库（primary）= Neon，读写。写路径永远只走主库，绝不故障切换，杜绝数据分叉。
 * - 备库（replica）= Supabase，只读热备。仅当主库出现「连接级」故障时，
 *   读路径自动切到备库，保证前台/API 可用。
 * - 数据由 Neon 单向同步到 Supabase（见 services/replication）。
 *
 * 导出：
 * - db      主库 drizzle（读写用；不故障切换）
 * - dbRead  故障切换 drizzle（公开前台/API 的只读查询用；主库挂了自动切备库）
 *
 * 环境变量：
 * - DATABASE_URL          必填。主库（Neon）连接串
 * - REPLICA_DATABASE_URL  可选。备库（Supabase）连接串；缺省则退化为单库、无故障切换
 * - DB_SSL                可选。"require"（默认）| "disable"（本地）
 * - DB_POOL_MAX           可选。每个连接池上限，默认 5
 * - DB_FAILOVER_COOLDOWN_MS 可选。主库故障后直连备库的冷却窗口，默认 30000
 */

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool, type PoolConfig } from "pg"
import * as schema from "./schema"

const primaryUrl = process.env.DATABASE_URL
const replicaUrl = process.env.REPLICA_DATABASE_URL

export type DbProvider = "neon" | "supabase" | "postgres" | "unknown"

/** 从连接串识别数据库供应商（仅用于日志/后台展示） */
export function detectDbProvider(url = primaryUrl ?? ""): DbProvider {
  if (!url) return "unknown"
  try {
    const host = new URL(url).hostname
    if (host.includes("neon.")) return "neon"
    if (host.includes("supabase.")) return "supabase"
    return "postgres"
  } catch {
    return "unknown"
  }
}

/** 解析 SSL：非本地默认强制 SSL（Neon/Supabase 均要求） */
function resolveSsl(url: string): PoolConfig["ssl"] {
  const mode = (process.env.DB_SSL ?? "require").toLowerCase()
  if (mode === "disable") return undefined
  let host = ""
  try {
    host = new URL(url).hostname
  } catch {
    /* ignore */
  }
  const isLocal = host === "localhost" || host === "127.0.0.1"
  if (isLocal && mode !== "require") return undefined
  return { rejectUnauthorized: false }
}

function poolMax(): number {
  const max = Number(process.env.DB_POOL_MAX ?? "5")
  return Number.isFinite(max) && max > 0 ? max : 5
}

/** 连接级错误（值得故障切换）：区别于 SQL 逻辑错误（不该切换） */
const CONNECTION_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "ECONNRESET",
  "EAI_AGAIN",
  "EPIPE",
  "08000", // connection_exception
  "08001", // sqlclient_unable_to_establish_sqlconnection
  "08003", // connection_does_not_exist
  "08004", // sqlserver_rejected_establishment_of_sqlconnection
  "08006", // connection_failure
  "57P01", // admin_shutdown
  "57P03", // cannot_connect_now
  "53300", // too_many_connections
])

function isConnectionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const code = (err as { code?: string }).code
  if (code && CONNECTION_ERROR_CODES.has(code)) return true
  const msg = (err as { message?: string }).message ?? ""
  return /timeout|timed out|terminating connection|connection terminated|ECONNREFUSED|ECONNRESET|fetch failed|could not connect/i.test(
    msg,
  )
}

/**
 * 故障切换连接池：本体是主库（Neon），持有一个只读备库池（Supabase）。
 * 只对「简单查询（Promise 形式）」做故障切换；事务（connect）与回调形式一律走主库。
 * 继承 Pool 以满足 drizzle 的事务分支 `instanceof Pool` 判定。
 */
export class FailoverPool extends Pool {
  private replica: Pool | null
  private primaryDownUntil = 0
  private readonly cooldownMs: number
  /** 最近一次读是否命中备库（供后台诊断） */
  lastServedByReplica = false

  constructor(primaryConfig: PoolConfig, replica: Pool | null) {
    super(primaryConfig)
    this.replica = replica
    this.cooldownMs = Number(process.env.DB_FAILOVER_COOLDOWN_MS ?? "30000")
  }

  private inCooldown(): boolean {
    return this.replica !== null && Date.now() < this.primaryDownUntil
  }

  // 覆盖 query：优先主库，连接级错误时切备库。用 any 以匹配 pg 的重载签名。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query(...args: any[]): any {
    // 回调形式（最后一个参数是函数）——不做故障切换，直接走主库
    const last = args[args.length - 1]
    if (typeof last === "function") {
      return super.query(...(args as Parameters<Pool["query"]>))
    }

    const runOnReplica = () => {
      this.lastServedByReplica = true
      return (this.replica as Pool).query(...(args as Parameters<Pool["query"]>))
    }

    // 冷却窗口内主库仍判定为不可用：直接走备库
    if (this.inCooldown()) {
      return runOnReplica()
    }

    const primaryPromise = super.query(...(args as Parameters<Pool["query"]>)) as unknown as Promise<unknown>
    return primaryPromise
      .then((res) => {
        this.lastServedByReplica = false
        return res
      })
      .catch((err) => {
        if (this.replica && isConnectionError(err)) {
          this.primaryDownUntil = Date.now() + this.cooldownMs
          console.log("[v0] 主库连接失败，读请求切换到备库（Supabase）：", (err as Error).message)
          return runOnReplica()
        }
        throw err
      })
  }
}

if (!primaryUrl) {
  throw new Error("DATABASE_URL 未设置：请配置主库（Neon）连接串")
}

// 主库池（写路径专用，永不故障切换）
export const pool = new Pool({
  connectionString: primaryUrl,
  ssl: resolveSsl(primaryUrl),
  max: poolMax(),
})

// 备库池（只读；仅在配置了 REPLICA_DATABASE_URL 时创建）
const replicaPool: Pool | null = replicaUrl
  ? new Pool({
      connectionString: replicaUrl,
      ssl: resolveSsl(replicaUrl),
      max: poolMax(),
    })
  : null

// 读路径池：故障切换（主 Neon → 备 Supabase）
const readPool = new FailoverPool(
  { connectionString: primaryUrl, ssl: resolveSsl(primaryUrl), max: poolMax() },
  replicaPool,
)

/** 主库 drizzle：读写用，永不故障切换（写入只落主库） */
export const db = drizzle(pool, { schema })

/** 故障切换 drizzle：公开前台/API 只读查询用，主库不可用时自动切备库 */
export const dbRead = drizzle(readPool, { schema })

/** 备库原始池（同步/诊断用；未配置则为 null） */
export const replicaPoolRaw = replicaPool

/** 是否配置了备库 */
export const hasReplica = replicaPool !== null

/** 当前主库供应商 */
export const dbProvider: DbProvider = detectDbProvider(primaryUrl)

/** 备库供应商 */
export const replicaProvider: DbProvider = replicaUrl ? detectDbProvider(replicaUrl) : "unknown"

/** 读路径最近是否命中备库（供后台诊断展示） */
export function isServingFromReplica(): boolean {
  return readPool.lastServedByReplica
}
