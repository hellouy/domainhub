"use server"

import { revalidatePath } from "next/cache"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import {
  runNextBatch,
  startBackfill,
  stopBackfill,
} from "@/services/crawl/backfill"

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) throw new Error("未授权")
}

/** 启动/重启某注册商的分批回填 */
export async function startBackfillAction(registrarId: number, batchSize = 50) {
  await requireAdmin()
  const res = await startBackfill(registrarId, batchSize)
  revalidatePath("/admin/crawls")
  return res
}

/** 停止回填(保留游标) */
export async function stopBackfillAction(registrarId: number) {
  await requireAdmin()
  await stopBackfill(registrarId)
  revalidatePath("/admin/crawls")
}

/** 立即手动跑一批(绕过间隔) */
export async function runBatchNowAction(registrarId: number) {
  await requireAdmin()
  const res = await runNextBatch(registrarId, { force: true })
  revalidatePath("/admin/crawls")
  revalidatePath("/admin")
  return res
}
