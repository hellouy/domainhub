import { NextResponse } from "next/server"
import { openApiSpec } from "@/lib/api/openapi"

/** GET /api/v1/openapi.json —— OpenAPI 3.0 规范（Swagger UI 数据源） */
export function GET() {
  return NextResponse.json(openApiSpec, {
    headers: { "Cache-Control": "public, max-age=3600" },
  })
}
