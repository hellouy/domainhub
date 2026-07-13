/**
 * DomainHub 公开 API 的 OpenAPI 3.0 规范（Sprint 4 Part 2）
 * 由 /api/v1/openapi.json 提供，/api-docs 页面渲染 Swagger UI。
 */

const priceItem = {
  type: "object",
  properties: {
    tld: { type: "string", example: "com" },
    registrar: { type: "string", example: "cloudflare" },
    registrarName: { type: "string", example: "Cloudflare" },
    registerPrice: { type: "string", nullable: true, example: "9.15" },
    renewPrice: { type: "string", nullable: true, example: "9.15" },
    transferPrice: { type: "string", nullable: true, example: "9.15" },
    currency: { type: "string", example: "USD" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "DomainHub API",
    version: "1.0.0",
    description:
      "域名价格比较平台公开 API。所有端点均有限流（120 次/分钟/IP），响应头携带 X-Request-Id 便于排障。",
  },
  servers: [{ url: "/api/v1", description: "v1（当前版本）" }],
  tags: [
    { name: "prices", description: "价格查询" },
    { name: "history", description: "历史价格" },
    { name: "registrars", description: "注册商" },
    { name: "statistics", description: "平台统计" },
  ],
  paths: {
    "/prices": {
      get: {
        tags: ["prices"],
        summary: "查询全部价格（支持筛选、排序、分页）",
        parameters: [
          { name: "tld", in: "query", schema: { type: "string" }, description: "按后缀过滤，如 com" },
          { name: "registrar", in: "query", schema: { type: "string" }, description: "按注册商 slug 过滤" },
          {
            name: "sort",
            in: "query",
            schema: { type: "string", enum: ["register", "renew", "transfer", "updated", "tld"], default: "tld" },
          },
          { name: "order", in: "query", schema: { type: "string", enum: ["asc", "desc"], default: "asc" } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
        ],
        responses: {
          "200": {
            description: "价格列表",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: priceItem },
                    pagination: {
                      type: "object",
                      properties: {
                        page: { type: "integer" },
                        limit: { type: "integer" },
                        total: { type: "integer" },
                        totalPages: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "参数格式非法" },
          "429": { description: "请求超过限流阈值" },
        },
      },
    },
    "/prices/{tld}": {
      get: {
        tags: ["prices"],
        summary: "单后缀在全部注册商的价格",
        parameters: [
          { name: "tld", in: "path", required: true, schema: { type: "string" }, example: "com" },
          {
            name: "sort",
            in: "query",
            schema: { type: "string", enum: ["register", "renew", "transfer"], default: "register" },
          },
          { name: "order", in: "query", schema: { type: "string", enum: ["asc", "desc"], default: "asc" } },
        ],
        responses: {
          "200": { description: "该后缀的注册商价格列表" },
          "404": { description: "未收录该后缀" },
        },
      },
    },
    "/history/{tld}": {
      get: {
        tags: ["history"],
        summary: "单后缀历史价格（按天聚合：最低/最高/平均/变动次数）",
        parameters: [
          { name: "tld", in: "path", required: true, schema: { type: "string" }, example: "com" },
          {
            name: "range",
            in: "query",
            schema: { type: "string", enum: ["7d", "30d", "90d", "365d"], default: "30d" },
          },
          { name: "registrar", in: "query", schema: { type: "string" }, description: "可选，按注册商过滤" },
        ],
        responses: {
          "200": {
            description: "按天聚合的历史价格",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    tld: { type: "string" },
                    range: { type: "string" },
                    days: { type: "integer" },
                    totalChanges: { type: "integer" },
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          day: { type: "string", example: "2026-07-13" },
                          lowest: { type: "string", example: "8.57" },
                          highest: { type: "string", example: "12.99" },
                          average: { type: "string", example: "10.20" },
                          changes: { type: "integer", example: 3 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "range 参数非法" },
          "404": { description: "未收录该后缀" },
        },
      },
    },
    "/registrars": {
      get: {
        tags: ["registrars"],
        summary: "注册商列表与价格覆盖数",
        parameters: [
          { name: "all", in: "query", schema: { type: "string", enum: ["1"] }, description: "传 1 时包含停用注册商" },
        ],
        responses: { "200": { description: "注册商列表" } },
      },
    },
    "/statistics": {
      get: {
        tags: ["statistics"],
        summary: "平台统计：均价、最便宜/最贵注册商、涨跌 Top",
        responses: { "200": { description: "平台统计数据" } },
      },
    },
  },
} as const
