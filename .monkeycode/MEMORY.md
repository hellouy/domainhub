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
- Date: 2026-09-26
- Context: Discovered by Agent while 将线上数据源从 Neon 切换到 Supabase
- Category: Troubleshooting & Debugging
- Instructions:
  - 本仓库 `pg` 为 v8.22+，其 `sslmode=require` 语义等同 `verify-full`；连接 Supabase Supavisor 池化端点（`*.pooler.supabase.com`，自签证书链）必须用 `?uselibpqcompat=true&sslmode=require`，否则报 `SELF_SIGNED_CERT_IN_CHAIN`
  - 页面查询层（`lib/db/queries.ts` 的 safeQuery / 服务层 withFallback）会静默兜底回 seed 数据，DB 故障时页面仍返回 200，因此判断"线上是否真连库"要看 `/api/v1/statistics` 的 `tldCount/priceCount/jobCount` 与 `lastUpdated` 是否来自数据库
  - 甄别兜底数据：seed 有 29 家 / 2608 后缀 / 11755 条，DB 为 29 家 / 2610 后缀 / 11708 条

[Project Knowledge Summary]
- Date: 2026-09-26
- Context: Discovered by Agent while 用 Vercel CLI 发布生产
- Category: Operations & Deployment
- Instructions:
  - 修改 Vercel 环境变量**不会**触发自动重新部署，必须再执行一次 `npx vercel@latest --prod --token <TOKEN>` 才生效
  - 用 CLI 发布需要项目已 link（`vercel link`）；link 会把 `.env*` 与 `.vercel` 写入 `.gitignore`，并把开发环境变量拉到 `/workspace/.env.local`
  - 生产域名 `www.tldbi.com` 绑定的项目为 `domainhub`，账号 `8839029-5124`；`vercel ls --prod` 首条即当前生产部署，运行日志用 `vercel logs <deployment-url> --token <TOKEN>`

[Project Knowledge Summary]
- Date: 2026-09-25
- Context: Discovered by Agent while fixing Vercel build ERR_PNPM_LOCKFILE_CONFIG_MISMATCH
- Category: Build Methods
- Instructions:
  - Vercel 用 pnpm@10.x 构建本仓库（package.json 已钉 packageManager: pnpm@10.34.5）；改动 package.json 的 pnpm.overrides 后必须 `pnpm install --no-frozen-lockfile` 重新生成 lockfile 并提交，否则冻结安装报 ERR_PNPM_LOCKFILE_CONFIG_MISMATCH
  - 本地 corepack 的 pnpm 损坏（MODULE_NOT_FOUND），修复方式：`corepack disable && npm i -g pnpm@10`
  - pnpm-workspace.yaml 的 allowBuilds 取值为布尔（esbuild: true / msw: false / sharp: true），不能留占位符字符串
  - 本地验证部署前先跑 `pnpm install --frozen-lockfile`（模拟 Vercel）再 `pnpm run build`

[Project Knowledge Summary]
- Date: 2026-09-27
- Context: Discovered by Agent while 用 Vercel REST API 直接部署生产（不依赖 CLI 登录）
- Category: Operations & Deployment
- Instructions:
  - 不用 `vercel` CLI 也能部署 git 关联项目：POST `https://api.vercel.com/v13/deployments?teamId=8839029-5124&force=true`，body 传 `{"name":"domainhub","target":"production","gitSource":{"type":"github","repoId":1299004490,"org":"hellouy","ref":"main"}}`（repoId 必须用项目 metadata 里真实的 1299004490，传 0 会报 incorrect_git_source_info）；Authorization: Bearer <VCP token>
  - 部署 id 用 `GET /v13/deployments/{id}?teamId=8839029-5124` 轮询 readyState 至 READY；target=production 会自动挂到 www.tldbi.com，验证用 `/api/v1/statistics` 核对 DB 数据未回退 seed
  - accountId/orgId 为 `team_7fiGBsOkagtxipEvpPg349yM`，但 API 的 teamId 参数用数字 `8839029-5124` 也可行（两种均返回同一 project）

[Project Knowledge Summary]
- Date: 2026-08-29
- Context: Discovered by Agent while 探测大洋洲注册商
- Category: Troubleshooting & Debugging
- Instructions:
  - webcentral.au 等澳大利亚注册商站点响应 21–60s 波动，worker 的 60s 导航超时频繁 502，浏览器策略采集不稳定，不适合入库
  - SSR 全量价格表站点（xserver.ne.jp、value-domain.com、muumuu-domain.com）最稳定，优先作为适配器候选