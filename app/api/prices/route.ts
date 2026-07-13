/**
 * 兼容层：/api/prices 已迁移到 /api/v1/prices（Sprint 4 Part 2）。
 * 旧地址保持可用，直接复用 v1 的处理器（含缓存、限流、指标）。
 */
export { GET } from "@/app/api/v1/prices/route"

export const dynamic = "force-dynamic"
