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

## 测试

```
npx tsx scripts/test-adapter.ts <slug>          # 8 类标准测试,写库
npx tsx scripts/test-adapter.ts <slug> --no-db  # 干跑,不写库
```
