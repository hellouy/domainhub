"use server"

import { isAdminAuthenticated } from "@/lib/admin-auth"
import type { CrawlJobResult } from "@/lib/crawler/types"
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
  revalidatePath("/", "layout")
}

/** 运行单个 Adapter */
export async function runAdapterAction(slug: string): Promise<CrawlJobResult> {
  await requireAdmin()
  const result = await crawlerRunner.runBySlug(slug)
  revalidateAll()
  return result
}

/** 运行全部启用的 Adapter */
export async function runAllAdaptersAction(): Promise<CrawlJobResult[]> {
  await requireAdmin()
  const results = await crawlerRunner.runAll()
  revalidateAll()
  return results
}

/** 停止一个进行中的任务 */
export async function stopJobAction(jobId: number): Promise<boolean> {
  await requireAdmin()
  const stopped = await crawlerRunner.stop(jobId)
  revalidateAll()
  return stopped
}

/** 重试一个失败/取消的任务 */
export async function retryJobAction(jobId: number): Promise<CrawlJobResult> {
  await requireAdmin()
  const result = await crawlerRunner.retryJob(jobId)
  revalidateAll()
  return result
}
