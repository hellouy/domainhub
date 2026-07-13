/**
 * POST /api/v1/repair —— 触发 LLM 修复代理(需管理员会话)
 * Body: { registrar: string, urls?: string[] }
 *   registrar: 注册商 slug
 *   urls: 候选价格页(省略时取 discovery_metadata.pricing_url 与官网)
 * 所有权: Platform Team, 文档: docs/architecture.md 自愈闭环一节
 */

import { eq } from "drizzle-orm"
import { NextResponse, type NextRequest } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { discoveryMetadata, registrars } from "@/lib/db/schema"
import { repairAdapter } from "@/packages/ai-repair"
import { chainDiagnostics } from "@/packages/ai-repair/model-chain"

export const maxDuration = 300

/** GET —— 查看模型链各渠道可用性(需管理员会话) */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ apiVersion: "v1", error: "未授权" }, { status: 401 })
  }
  return NextResponse.json({ apiVersion: "v1", data: { chain: chainDiagnostics() } })
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ apiVersion: "v1", error: "未授权" }, { status: 401 })
  }

  let body: { registrar?: string; urls?: string[] } = {}
  try {
    body = await request.json()
  } catch {
    // fallthrough
  }
  if (!body.registrar) {
    return NextResponse.json({ apiVersion: "v1", error: "缺少 registrar 参数" }, { status: 400 })
  }

  try {
    // 收集候选 URL: 请求提供的 + discovery_metadata + 官网
    const urls = new Set<string>(body.urls ?? [])
    const [reg] = await db
      .select({ id: registrars.id, website: registrars.website })
      .from(registrars)
      .where(eq(registrars.slug, body.registrar))
    if (!reg) {
      return NextResponse.json({ apiVersion: "v1", error: "注册商不存在" }, { status: 404 })
    }
    const [meta] = await db
      .select({ pricingUrl: discoveryMetadata.pricingUrl })
      .from(discoveryMetadata)
      .where(eq(discoveryMetadata.registrarId, reg.id))
    if (meta?.pricingUrl) urls.add(meta.pricingUrl)
    if (urls.size === 0 && reg.website) urls.add(reg.website)

    const result = await repairAdapter(body.registrar, Array.from(urls))
    return NextResponse.json({ apiVersion: "v1", data: result }, { status: result.ok ? 200 : 422 })
  } catch (error) {
    return NextResponse.json(
      { apiVersion: "v1", error: error instanceof Error ? error.message : "修复失败" },
      { status: 500 },
    )
  }
}
