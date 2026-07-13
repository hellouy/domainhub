# 30 分钟接入一个新注册商

> 所有权:Platform Team · 前置阅读:`docs/adapter-sdk.md`

新注册商 = **一个配置文件 + 一行注册 + 一条数据库记录**。不需要新基础设施,不需要改平台代码。

## 第 1 步:添加注册商记录(约 2 分钟)

后台 `/admin/registrars` 添加,或 SQL:

```sql
INSERT INTO registrars (slug, name, website, description, is_active)
VALUES ('spaceship', 'Spaceship', 'https://www.spaceship.com', '...', true);
```

`slug` 必须与适配器的 `slug` 一致。

## 第 2 步:找到数据源(约 10 分钟)

按优先级探测(越靠前越稳定、维护成本越低):

1. **官方定价 API** —— 如 Porkbun `POST /api/json/v3/pricing/get`
2. **XHR/JSON 接口** —— 打开定价页,浏览器 DevTools Network 过滤 XHR,找返回价格 JSON 的请求(如 Dynadot `domain-search?command=get_current_list`)
3. **Hydration 数据** —— 查看页面源码中的 `__NEXT_DATA__` / `__NUXT__`
4. **CSV/XML 下载** —— 部分注册商提供价格表下载
5. **HTML 表格** —— 服务端渲染的定价表
6. **Playwright** —— 最后手段(需要 JS 渲染的页面)

建议声明 2 个以上策略,引擎自动降级。

## 第 3 步:编写适配器(约 10 分钟)

创建 `adapters/<slug>.ts`:

```ts
import { defineAdapter } from "@/packages/adapter-sdk"

export const spaceshipAdapter = defineAdapter({
  slug: "spaceship",
  name: "Spaceship",
  website: "https://www.spaceship.com",
  version: "1.0.0",
  parserVersion: "1.0.0",
  owner: "你的名字",
  currency: "USD",
  capabilities: { registration: true, renewal: true, transfer: true },
  rateLimit: { rpm: 30, concurrency: 1, maxRetries: 3, timeoutMs: 30_000 },
  strategies: [
    {
      type: "xhr",
      url: "https://…/price-endpoint",
      parse: async (res) => {
        const data = await res.json()
        return data.items.map((it: any) => ({
          tld: it.tld,                    // 允许带点,SDK 自动清洗
          registerPrice: it.register,     // string 或 number 均可
          renewPrice: it.renew,
          transferPrice: it.transfer,
        }))
      },
    },
  ],
})
```

在 `adapters/index.ts` 注册:

```ts
import { spaceshipAdapter } from "./spaceship"
registerAdapter(spaceshipAdapter)
```

需要凭证的私有 API:在 `/admin/credentials` 添加凭证,适配器里 `await ctx.getCredential("api_key")` 使用。

## 第 4 步:测试(约 5 分钟)

```
npx tsx scripts/test-adapter.ts spaceship --no-db   # 干跑 8 类测试
npx tsx scripts/test-adapter.ts spaceship           # 通过后真实写库
```

8 类测试:Connection / Fetch / Parse / Normalize / Validation / Storage / Coverage / Health。

## 第 5 步:上线(约 3 分钟)

1. 后台 `/admin/registrars` 点击"采集"验证端到端
2. 确认健康分、策略、覆盖率显示正常
3. 完成。该注册商自动进入每日 cron 调度

## 检查清单

- [ ] `slug` 与数据库一致
- [ ] 至少 1 个策略,推荐 2+(自动降级)
- [ ] `owner` 已填写
- [ ] 8/8 测试通过
- [ ] 没有在 `adapters/` 之外添加任何注册商特定代码
