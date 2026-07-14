"use server"

import { revalidatePath } from "next/cache"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { runReplication } from "@/services/replication/sync"

/** 后台手动触发一次 Neon→Supabase 同步 */
export async function triggerReplicationAction() {
  if (!(await isAdminAuthenticated())) throw new Error("未授权")
  const result = await runReplication()
  revalidatePath("/admin/replication")
  return result
}
