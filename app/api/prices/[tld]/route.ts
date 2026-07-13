/**
 * 兼容层：/api/prices/{tld} 已迁移到 /api/v1/prices/{tld}（Sprint 4 Part 2）。
 */
export { GET } from "@/app/api/v1/prices/[tld]/route"

export const dynamic = "force-dynamic"
