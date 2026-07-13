"use client"

import { useEffect, useRef } from "react"

/**
 * Swagger UI 文档页（/api-docs）
 * 通过 CDN 加载 swagger-ui-dist，渲染 /api/v1/openapi.json。
 * 不引入 npm 依赖，避免与 React 19 的兼容问题。
 */
export default function ApiDocsPage() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const css = document.createElement("link")
    css.rel = "stylesheet"
    css.href = "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"
    document.head.appendChild(css)

    const script = document.createElement("script")
    script.src = "https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"
    script.onload = () => {
      const w = window as unknown as { SwaggerUIBundle?: (opts: Record<string, unknown>) => void }
      if (w.SwaggerUIBundle && containerRef.current) {
        w.SwaggerUIBundle({
          url: "/api/v1/openapi.json",
          domNode: containerRef.current,
          deepLinking: true,
          tryItOutEnabled: true,
        })
      }
    }
    document.body.appendChild(script)

    return () => {
      css.remove()
      script.remove()
    }
  }, [])

  return (
    <main className="min-h-svh bg-white">
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">TLDbi API 文档</h1>
        <p className="text-sm text-gray-500">
          {"OpenAPI 规范："}
          <a href="/api/v1/openapi.json" className="underline">
            /api/v1/openapi.json
          </a>
        </p>
      </div>
      <div ref={containerRef} aria-label="Swagger UI" />
    </main>
  )
}
