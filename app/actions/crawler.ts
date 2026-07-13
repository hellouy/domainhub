"use server"

import { isAdminAuthenticated } from "@/lib/admin-auth"
import type { CrawlJobResult } from "@/lib/crawler/types"
import { auditService } from "@/services/audit"
import { crawlerRunner } from "@/services/crawler"
import { revalidatePath } from "next/cache"

/** 采集引擎的后台 Server Actions（全部需要管理员会话） */

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) throw new Error("未授权")
}

function revalidateAll() {
  revalidatePath("/admin")
  revalidatePath("/admin/crawler")
  revalidatePath("/admin/crawls")
  revalidatePath("/admin/health")
  revalidatePath("/admin/data-quality")
  revalidatePath("/admin/scheduler")
  revalidatePath("/admin/intelligence")
  revalidatePath("/", "layout")
}

/** 运行单个 Adapter */
export async function runAdapterAction(slug: string): Promise<CrawlJobResult> {
  await requireAdmin()
  void auditService.audit("crawler.run", `运行单个 Adapter：${slug}`)
  const result = await crawlerRunner.runBySlug(slug)
  revalidateAll()
  return result
}

/** 运行全部启用的 Adapter */
export async function runAllAdaptersAction(): Promise<CrawlJobResult[]> {
  await requireAdmin()
  void auditService.audit("crawler.run_all", "运行全部启用的 Adapter")
  const results = await crawlerRunner.runAll()
  revalidateAll()
  return results
}

/** 停止一个进行中的任务 */
export async function stopJobAction(jobId: number): Promise<boolean> {
  await requireAdmin()
  void auditService.audit("crawler.stop", `停止任务 #${jobId}`)
  const stopped = await crawlerRunner.stop(jobId)
  revalidateAll()
  return stopped
}

/** 重试一个失败/取消的任务 */
export async function retryJobAction(jobId: number): Promise<CrawlJobResult> {
  await requireAdmin()
  void auditService.audit("crawler.retry", `重试任务 #${jobId}`)
  const result = await crawlerRunner.retryJob(jobId)
  revalidateAll()
  return result
}

/** 重试所有"最近一次运行失败/取消"的注册商 */
export async function retryFailedAction(): Promise<CrawlJobResult[]> {
  await requireAdmin()
  void auditService.audit("crawler.retry_failed", "重试所有失败的注册商")
  const results = await crawlerRunner.retryFailed()
  revalidateAll()
  return results
}

/** 更新每日定时采集设置 */
export async function updateSchedulerAction(patch: { enabled?: boolean; runHourUtc?: number }): Promise<void> {
  await requireAdmin()
  const { storageService } = await import("@/services/storage")
  if (patch.runHourUtc !== undefined && (patch.runHourUtc < 0 || patch.runHourUtc > 23)) {
    throw new Error("运行时刻必须在 0-23 之间")
  }
  void auditService.audit(
    "scheduler.update",
    `调度设置变更：${JSON.stringify(patch)}`,
  )
  await storageService.updateSchedulerSettings(patch)
  revalidatePath("/admin/scheduler")
}
