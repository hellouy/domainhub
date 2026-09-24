# User Instruction Memory

This file records user instructions, preferences, and teachings for reference in future interactions.

## Format

### User Instruction Entry
User instruction entries should follow this format:

[User Instruction Summary]
- Date: [YYYY-MM-DD]
- Context: [Mentioned scenario or time]
- Instructions:
  - [Content of user teaching or instruction, described line by line]

### Project Knowledge Entry
Entries discovered by the Agent during task execution should follow this format:

[Project Knowledge Summary]
- Date: [YYYY-MM-DD]
- Context: Discovered by Agent while performing [specific task description]
- Category: [Operations & Deployment|Build Methods|Testing Methods|Troubleshooting & Debugging|Workflow & Collaboration|Environment Configuration]
- Instructions:
  - [Specific knowledge points, described line by line]

## Deduplication Strategy
- Before adding a new entry, check for similar or identical instructions.
- If a duplicate is found, skip the new entry or merge it with the existing one.
- When merging, update the context or date information.
- This helps avoid redundant entries and keeps the memory file tidy.

## Entries

[Project Knowledge Summary]
- Date: 2026-08-29
- Context: Discovered by Agent while debugging browser-worker 渲染失败
- Category: Build Methods
- Instructions:
  - browser-worker 必须用 `node --experimental-strip-types src/server.ts` 启动（package.json start 已如此配置），不能用 tsx 启动：tsx 宿主下浏览器端 page.evaluate 抛 `__name is not defined`，全部 /render 失败
  - 改动 browser-worker 代码后需重启该后台终端才能生效
  - 同一个 PORT 只能有一个 worker 实例：重启前先用 background_terminal_kill 停掉旧实例（后启动实例会 EADDRINUSE，请求继续由旧代码进程服务，改动不生效）

[Project Knowledge Summary]
- Date: 2026-08-29
- Context: Discovered by Agent while implementing api-fetch 采集形态
- Category: Troubleshooting & Debugging
- Instructions:
  - Playwright 1.49 的 BrowserContext 没有 `context.request` API，需改用 `page.evaluate` 内原生 fetch 重放接口（页面上下文自动携带会话 cookie、保持同源特征）
  - hostinger 定价接口 `POST /api-proxy/api/domain/tlds-pricing` 需要 `authorization: Bearer www.hostinger.com` 头 + 会话 cookie；body 需显式 `tlds` 数组（空列表返回 422），可一次带一批 TLD 全量取价
  - SDK 侧干跑适配器用 tsx 即可（无 page.evaluate），只有 browser-worker 进程才必须 node strip-types；node strip-types 不识别 `@/` 别名的脚本需用相对路径 import

[Project Knowledge Summary]
- Date: 2026-08-29
- Context: Discovered by Agent while 探测大洋洲注册商
- Category: Troubleshooting & Debugging
- Instructions:
  - webcentral.au 等澳大利亚注册商站点响应 21–60s 波动，worker 的 60s 导航超时频繁 502，浏览器策略采集不稳定，不适合入库
  - SSR 全量价格表站点（xserver.ne.jp、value-domain.com、muumuu-domain.com）最稳定，优先作为适配器候选