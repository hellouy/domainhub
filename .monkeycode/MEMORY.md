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

[Project Knowledge Summary]
- Date: 2026-08-29
- Context: Discovered by Agent while 探测大洋洲注册商
- Category: Troubleshooting & Debugging
- Instructions:
  - webcentral.au 等澳大利亚注册商站点响应 21–60s 波动，worker 的 60s 导航超时频繁 502，浏览器策略采集不稳定，不适合入库
  - SSR 全量价格表站点（xserver.ne.jp、value-domain.com、muumuu-domain.com）最稳定，优先作为适配器候选