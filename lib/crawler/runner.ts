import { db } from "@/lib/db"
import { registrars } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { crawlerRunner } from "@/services/crawler"
import { storageService } from "@/services/storage"
import type { CrawlJobResult } from "./types"

/**
 * 兼容层：保留旧的 runCrawlJob / getJobLogs 接口，
 * 实际执行委托给 services/crawler 的 CrawlerRunner。
 * 新代码请直接使用 crawlerRunner（支持 runAll / retryJob / stop）。
 */

export type { CrawlJobResult }

/** 按注册商 ID 执行一次采集（旧接口，委托 CrawlerRunner） */
export async function runCrawlJob(registrarId: number): Promise<CrawlJobResult> {
  const [registrar] = await db.select().from(registrars).where(eq(registrars.id, registrarId))
  if (!registrar) {
    return {
      jobId: 0,
      registrarSlug: "unknown",
      status: "failed",
      ok: false,
      message: "注册商不存在",
      totalTlds: 0,
      updated: 0,
      inserted: 0,
      skipped: 0,
      rejected: 0,
      attempts: 0,
      durationMs: 0,
      error: "注册商不存在",
    }
  }
  return crawlerRunner.runBySlug(registrar.slug)
}

/** 某任务的日志（旧接口，委托 Storage 服务） */
export async function getJobLogs(jobId: number) {
  return storageService.getJobLogs(jobId)
}
