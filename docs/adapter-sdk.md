# Adapter SDK 2.0

> 所有权:Platform Team · 代码:`packages/adapter-sdk/`

每个注册商适配器实现完全相同的契约。SDK 提供 `defineAdapter()`、`BaseAdapter`、`AdapterContext`、`AdapterResult`,生命周期逻辑零重复。

## 9 阶段生命周期

| 阶段 | 职责 | 默认实现 |
|---|---|---|
| initialize | 准备工作(可选) | `hooks.initialize` |
| discover | 确定数据源端点 | 从策略定义推导 |
| fetch | 下载原始数据 | 策略引擎(自动降级) |
| parse | 原始数据 → RawPrice[] | 策略的 `parse` 函数 |
| validate | 校验价格合理性 | 校验平台(`validation.ts`) |
| normalize | RawPrice → 标准价格模型 | `BaseAdapter.normalize` |
| compare | 与现有价格 diff | Storage 平台 |
| save | 只写变化行 + 历史 | Storage 平台 |
| cleanup | 资源清理(失败不影响结果) | `hooks.cleanup` |

适配器通常**只需要声明策略**,不需要重写任何生命周期方法。

## defineAdapter 最小示例

```ts
import { defineAdapter } from "@/packages/adapter-sdk"

export const exampleAdapter = defineAdapter({
  slug: "example",             // 必须与 registrars.slug 一致
  name: "Example Registrar",
  website: "https://example.com",
  version: "1.0.0",            // 适配器版本
  parserVersion: "1.0.0",      // 解析逻辑版本
  owner: "Platform Team",
  currency: "USD",
  priority: 100,
  capabilities: { registration: true, renewal: true, api: true },
  rateLimit: { rpm: 30, concurrency: 1, maxRetries: 3, timeoutMs: 30_000 },
  strategies: [
    {
      type: "api",
      url: "https://api.example.com/pricing",
      parse: async (res) => {
        const data = await res.json()
        return Object.entries(data.pricing).map(([tld, p]: [string, any]) => ({
          tld,
          registerPrice: p.registration,
          renewPrice: p.renewal,
          transferPrice: p.transfer,
        }))
      },
    },
    // 可选降级策略,引擎自动按顺序尝试
    { type: "html", url: "https://example.com/pricing", parse: ... },
  ],
})
```

## AdapterContext

运行时注入,适配器不直接接触数据库或全局状态:

- `ctx.fetch(url, init)` —— 带限流/重试/熔断的 fetch
- `ctx.log(level, message)` —— 写入 crawl_logs
- `ctx.getCredential(type?)` —— 读取解密后的凭证(见 docs/credentials.md)
- `ctx.knownTlds` —— 平台已收录的 TLD 集合(计算覆盖率用)

## AdapterResult

`run()` 返回统一结构:`ok`、`strategy`(实际使用的策略)、`prices`(已校验)、`metrics`(阶段计时/行数/覆盖率/策略尝试记录)、`discovery`(发现元数据)、`error`。

## 标准价格模型(NormalizedPrice)

所有适配器输出完全一致的结构,禁止自定义结构:

```
registrar, tld, currency,
registerPrice, renewPrice, transferPrice, restorePrice,
premium, promotion, promoCode,
region, billingPeriod,
source, sourceUrl, strategy,
adapterVersion, parserVersion, collectedAt
```

价格字段统一为 `number | null`(单位:适配器声明的币种,年付)。`parsePriceString` 会自动清洗 `"$10.44"`、`"1,299.00"` 等格式。

## 版本

每个适配器暴露 `version`(适配器)、`parserVersion`(解析逻辑)、`sdkVersion`(SDK,当前 2.0.0)。三者都会写入每条价格与 crawl_jobs.metrics。

## 限流与熔断

`rateLimit` 声明式配置:`rpm`、`concurrency`、`maxRetries`、`timeoutMs`、`backoffMs`(指数退避 + 抖动)、熔断器(连续失败自动打开,冷却后半开试探)。实现见 `packages/adapter-sdk/rate-limit.ts`。

## Browser Strategy(浏览器渲染降级)

### 背景

Vercel serverless 无法运行无头浏览器。JS 渲染 / SPA / 动态表格 / 部分反爬站点的价格页,普通 fetch 拿不到表格内容。SDK 的 `playwright` 策略把渲染与提取外包给独立部署的浏览器服务(`browser-worker/`),本身仍是普通 HTTP 调用,生命周期(parse → validate → save)完全不变。

### 使用方式

在策略中声明 `type: "playwright"` + `browser` 选项,通常作为 HTML/XHR 策略之后的降级链:

```ts
{
  type: "html",
  url: "https://www.example.com/pricing",
  // ...html 表格解析
},
{
  type: "playwright",
  url: "https://www.example.com/pricing",
  browser: {
    extract: "extract-json",            // 默认;服务端注入 extract.js,返回规范化价格
    waitFor: "table.pricing-table tr",  // 表格挂载后出现的选择器
    waitForTimeoutMs: 30_000,
    scrollToBottom: true,               // 提取前滚动到底触发动态加载
    locale: "en-US",                    // 模拟地区,影响 GeoIP 分区定价
    headers: { "Referer": "https://..." }, // 初始导航附加请求头
    // script: "..."                    // 自定义提取脚本(默认用内置 extract.js)
  },
},
```

- `extract: "extract-json"`(默认):服务端 `browser-worker` 加载页面后注入 `scripts/browser-capture/extract.js`(表格优先、div 网格兜底),规范化输出 `[{ tld, registerPrice, renewPrice, transferPrice, sourceUrl }]`,SDK 默认 parse 直接消费。
- `extract: "html"`:返回渲染后的完整 HTML,配合自定义 `parse`(如复用 table-adapter 解析)使用。

### 表格型注册商一键降级

直接用 `createTableAdapter`(见 `adapters/shared/table-adapter.ts`)的注册商(15 家 table 注册商),工厂已内置浏览器降级,只需把 HTML 策略当作降级触发、追加 `browser` 配置:

```ts
createTableAdapter({
  slug: "hover",
  // ...表格结构配置(原有不变)
  browser: {
    waitFor: "table.pricing-table tr",
    waitForTimeoutMs: 30_000,
    scrollToBottom: true,
  },
})
```

HTML 解析拿不到价格时,工厂自动追加一个指向同一价格页的 playwright 降级策略。

### 环境变量

- `BROWSER_SERVICE_URL`(主站点):playwright 策略转发地址。未配置时 playwright 策略直接抛错,适配器按降级链继续,不会影响其他策略。
- `PORT`(默认 8840):browser-worker 监听端口。
- `BROWSER_WORKER_CONCURRENCY`(默认 2):并发渲染闸门(内存受限)。
- `BROWSER_WORKER_TIMEOUT_MS`(默认 90_000):单任务渲染超时。

### 浏览器服务契约(`browser-worker/`)

独立 Node 服务,任意可运行 Playwright 的主机部署(`npm install && npx playwright install --with-deps chromium && npm start`):

```
POST /render  { url, extract?, waitFor?, waitForTimeoutMs?, scrollToBottom?, locale?, headers?, script? }
→ { ok, finalUrl, title, extracted[] | html, error?, durationMs }
GET  /health  { ok, chromiumAvailable, activeTasks, concurrency }
```

`/render` 在导航 + networkidle + 可选 waitFor 后执行提取;超时或提取为空返回 502,SDK 侧据此降级到下一策略。

## 测试

```
npx tsx scripts/test-adapter.ts <slug>          # 8 类标准测试,写库
npx tsx scripts/test-adapter.ts <slug> --no-db  # 干跑,不写库
```
