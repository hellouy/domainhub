import "server-only"

import { db } from "@/lib/db"
import { auditLogs } from "@/lib/db/schema"
import { desc } from "drizzle-orm"

/**
 * Audit 服务：管理操作审计日志（Sprint 4 Part 9）
 *
 * 所有会改变系统状态的管理操作（触发采集、停止任务、修改调度、编辑注册商）
 * 都通过 `audit()` 记录一条不可变日志：谁（actor）、做了什么（action）、
 * 细节（detail）、何时（created_at）。
 *
 * 写入是尽力而为：审计失败绝不能阻断业务操作本身。
 */

export class AuditService {
  async audit(action: string, detail = "", actor = "admin", requestId = ""): Promise<void> {
    try {
      await db.insert(auditLogs).values({ action, detail, actor, requestId })
    } catch (err) {
      console.log("[v0] audit write failed:", err instanceof Error ? err.message : err)
    }
  }

  async recent(limit = 50) {
    return db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(limit)
  }
}

export const auditService = new AuditService()
