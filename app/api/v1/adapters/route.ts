/**
 * GET /api/v1/adapters —— 已注册的 Adapter SDK 适配器列表
 * (版本/策略优先级/负责人/能力)
 * 所有权: API Team, 文档: docs/api.md
 */

import { NextResponse } from "next/server"
import { listRegisteredAdapters } from "@/packages/registry"
import "@/adapters"

export async function GET() {
  const data = listRegisteredAdapters().map((a) => ({
    slug: a.slug,
    name: a.name,
    website: a.website ?? null,
    owner: a.owner ?? null,
    adapterVersion: a.version,
    parserVersion: a.parserVersion,
    sdkVersion: a.sdkVersion,
    strategyPriority: a.strategyPriority,
    priority: a.priority,
    capabilities: a.capabilities ?? null,
  }))
  return NextResponse.json({ apiVersion: "v1", count: data.length, data })
}
