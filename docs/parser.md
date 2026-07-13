# Parser 平台

> 所有权:Platform Team · 代码:`packages/parser/`

Parser 平台独立于适配器与存储,提供通用解析能力。适配器策略的 `parse` 函数可以直接使用这些工具,而不必手写解析逻辑。

## 提供的解析器

| 解析器 | 函数 | 说明 |
|---|---|---|
| JSON | `parseJson(text)` | 安全解析,失败返回 null |
| 嵌入 JSON | `extractEmbeddedJson(html, marker)` | 从 HTML 中提取 `__NEXT_DATA__`、`__NUXT__`、任意 `<script>` 内嵌 JSON |
| Next.js Hydration | `parseNextData(html)` | 提取并解析 `__NEXT_DATA__` |
| Nuxt Payload | `parseNuxtPayload(html)` | 提取 `window.__NUXT__` payload |
| HTML 表格 | `parseHtmlTables(html)` | 无依赖的 `<table>` 解析,输出 `string[][]`(每表一个矩阵) |
| CSV | `parseCsv(text)` | 支持引号转义、逗号内嵌,输出 `string[][]` |
| XML/RSS | `parseXmlItems(xml, tag)` | 提取指定标签的文本内容 |
| GraphQL | `graphqlQuery(fetch, endpoint, query, variables)` | POST 查询并返回 `data` |
| 价格字符串 | `parsePriceString(v)` | `"$10.44"` / `"1,299"` / number → `number \| null` |
| 指纹 | `fingerprint(text)` | 数据源结构 hash(FNV-1a),检测源结构变化 |

## 自动选择

策略引擎按策略类型自动匹配默认解析路径:

- `api` / `private-api` / `json` / `xhr` → `parseJson`
- `graphql` → `graphqlQuery`
- `hydration` → `parseNextData` → `parseNuxtPayload` → `extractEmbeddedJson`
- `html` → `parseHtmlTables`
- `csv` → `parseCsv`
- `xml` / `rss` → `parseXmlItems`

适配器仍需提供 `parse` 函数把解析结果映射为 `RawPrice[]`(字段映射是注册商特定知识,属于适配器职责)。

## 设计规则

1. Parser 不访问网络、不访问数据库,纯函数,可独立单测。
2. Parser 不包含任何注册商特定逻辑。
3. 新解析器必须在本文档注册并导出自 `packages/parser/index.ts`。
