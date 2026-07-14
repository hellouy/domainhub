/**
 * DB 连接层 —— 供应商无关的 Postgres 连接
 * ------------------------------------------------------------
 * 所有权：Platform Team
 * 文档：docs/db-portability.md
 *
 * 设计目标：同一套代码可在 Neon / Supabase / 通用 Postgres 之间切换，
 * 仅靠环境变量，无需改动任何业务代码或 schema。
 *
 * 之所以统一用 node-postgres（pg）：三家都是标准 Postgres over TCP+SSL，
 * pg 驱动通吃；business code 全部同步 `import { db }`，无需引入异步驱动。
 *
 * 环境变量：
 * - DATABASE_URL   必填。Postgres 连接串（Neon/Supabase/自建均可）
 * - DB_DRIVER      可选。目前仅 "pg"（默认）。保留字段以便将来接入其它驱动
 * - DB_SSL         可选。"require"（默认，非本地强制 SSL）| "disable"（本地无 SSL）
 * - DB_POOL_MAX    可选。连接池上限，serverless 建议较小，默认 5
 */

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool, type PoolConfig } from "pg"
import * as schema from "./schema"

const connectionString = process.env.DATABASE_URL

/** 从连接串识别数据库供应商（仅用于日志/后台展示，不影响连接行为） */
export function detectDbProvider(url = connectionString ?? ""): "neon" | "supabase" | "postgres" | "unknown" {
  if (!url) return "unknown"
  try {
    const host = new URL(url).hostname
    if (host.includes("neon.tech") || host.includes("neon.")) return "neon"
    if (host.includes("supabase.co") || host.includes("supabase.")) return "supabase"
    if (host === "localhost" || host === "127.0.0.1") return "postgres"
    return "postgres"
  } catch {
    return "unknown"
  }
}

/** 解析 SSL 配置：非本地默认强制 SSL（Neon/Supabase 均要求） */
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
  // 托管 Postgres 常用链路证书，rejectUnauthorized:false 兼容性最好
  return { rejectUnauthorized: false }
}

function createPool(): Pool {
  if (!connectionString) {
    throw new Error("DATABASE_URL 未设置：请配置 Postgres 连接串（Neon/Supabase/自建）")
  }
  const driver = (process.env.DB_DRIVER ?? "pg").toLowerCase()
  if (driver !== "pg") {
    // 目前只支持 pg；保留分支便于未来扩展并给出清晰错误
    throw new Error(`不支持的 DB_DRIVER="${driver}"，当前仅支持 "pg"`)
  }
  const max = Number(process.env.DB_POOL_MAX ?? "5")
  return new Pool({
    connectionString,
    ssl: resolveSsl(connectionString),
    max: Number.isFinite(max) && max > 0 ? max : 5,
  })
}

export const pool = createPool()
export const db = drizzle(pool, { schema })

/** 当前连接的供应商（供后台/诊断展示） */
export const dbProvider = detectDbProvider()
