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

[Project Knowledge Summary]
- Date: 2026-09-28
- Context: Discovered by Agent while 注册商广度扩展到 32 家
- Category: Operations & Deployment
- Instructions:
  - 批量新增注册商完整链路：export-prices（ONLY_SLUGS 指定集）→ 合并闪断失败源 → generate-seed-data → bulk-load-new.cjs 入库 → tsc+next build → commit+push → Vercel REST 部署 → 验证 /api/v1/statistics
  - 后台跑 export-prices 等重采时**必须显式传 `BROWSER_SERVICE_URL=http://127.0.0.1:8840`**，否则依赖浏览器降级的源（namecom/namesilo/onamae/cloudns/101domain 等）会 FAIL（playwright: 需配置 BROWSER_SERVICE_URL）；像直接 curl 一样后台也很容易漏传导致整轮重采大量 FAIL
  - truehost 价格源是 `truehost.co.ke`（KES 肯尼亚先令），不是 `truehost.cloud`（现已不可访问且误标 USD）；columnOrder 需带 `"skip"` 忽略 Grace 列
  - export 单家闪断（xhr:terminated / playwright 302/502 / 提取空行）不代表结构坏：本轮 hostpoint/101domain/krystal 失败，从上一版 `data/prices-20260927.json` 合并携带其数据到新 export 防回归（DB 用 upsert 无 delete，缺失 slug 行不会被清）
  - 数据准确性排查方法论：核对 `/api/v1/prices?tld=<ccTLD>` 新注册商首行真实值（ukrnames .ua 3528 UAH / idwebhost .id 190000 IDR / keliweb .it 1290 EUR），对照 sourceUrl 原始站点校验；DB 口径见 /api/v1/statistics，最新 32 active / 2998 tlds / 16875 prices（infomaniak 仍 is_active=false）
  - 生产验证用 www.tldbi.com（Vercel 项目 domainhub，账号 8839029-5124），不用本地 host
  - 最新口径见 /api/v1/statistics（2026-09-29：32 active / 3001 tlds / 16817 prices）

[User Instruction Summary]
- Date: 2026-09-28
- Context: 用户要求继续扩量到 100+ 家，同时对现有已接入数据做准确性排查，确保无误
- Instructions:
  - 扩量优先打通批发/API 价源（一个源覆盖数百 TLD）作为主杠杆；凭证齐全前并行广度扫描各大洲干净 SSR 表格/公开 JSON/simple XHR 注册商，命中标准: 无登录、无 Cloudflare、结构稳定
  - 数据排查维度：对照 sourceUrl 原始站点三列（register/renew/transfer）逐家抽查；校验 @ 首年促销价 vs 常规价不误标；防 unicode 报价（如规划中的 3371 值）、cheap 列无条件价格、负数/0、列错位；对明显脏数据从适配器注册表移除 + DB is_active=false，不靠 seed 掩盖
  - 每轮改动（新增适配器/数据修复）都要 tsc+build 通过并部署到 Vercel 生产后再向用户汇报，保留提交日志 traceability
[User Instruction Summary]
- Date: 2026-09-29
- Context: 用户要求「后台适配所有需 API 的注册商，后期填 Key 即自动生效采集」
- Instructions:
  - 需 API 的注册商（godaddy/namecheap/netim/gandi/infomaniak/enom/resellerclub）在后台预置骨架适配器，保持 is_active=false 就绪，不在前端展示
  - 填 Key 自动生效机制：createCredential/toggleCredential 激活凭证时联动把 registrars.is_active 置 true → scheduleAll 自动入队采集，无需手动激活
  - 采集端 services/crawl/index.ts 的 getCredentialForRegistrar 从 registrar_credentials 读 active 凭证并 AES 解密注入 ctx；export-prices 命令行用的是 null ctx（不接凭据），真实凭据采集走 /api/v1/crawl 或 cron/api/cron/crawl
  - API 适配器（enom/infomaniak/resellerclub 等骨架）的价格字段名契约已标注"需真实 Key 首采核验微调"，首采后按实际返回 JSON 微调 parse
  - 后台凭证录入类型：gandi/godaddy/namecheap/netim 等在 docs/credentials.md；新骨架 enom=basic(UID/PW), resellerclub=api_key(token=api-key,secret=auth-userid), infomaniak=api_key(token)

[Project Knowledge Summary]
- Date: 2026-10-03
- Context: Discovered by Agent while 从 ICANN/IANA 官方清单构建全局注册商发现索引
- Category: Troubleshooting & Debugging
- Instructions:
  - 全局注册商发现主源(官方、稳定、静态可爬)：
    - ICANN 认证注册商清单 `https://www.icann.org/en/contracted-parties/accredited-registrars/list-of-accredited-registrars`（Angular SPA 但服务端渲染首屏，curl 200；行结构 `<label class="search-drop-down__item"><span>Company Name - IANA_ID</span>`；另有 `registrar-launch` 链接给官网）。沙箱对 icann.org 出站间歇 ECONNRESET，需重试。
    - IANA `https://www.iana.org/assignments/registrar-ids/registrar-ids-1.csv`（4505 行 CSV：ID,Name,Status,RDAP URL；CSV 字段带引号含逗号须自写 parseCSV，不能 split(',')）。RDAP URL 的 host 常是注册商域名但多是批发/中间层（`*.tucows.com`/`ascio.com`/`corenic.net`/`rdap*.`）须过滤。
  - 已产出索引：ICANN 3322 家(带 IANA ID) → join IANA → 469 唯一域 → 过滤批发/中间层后 407 候选域（`/tmp/opencode/vw/candidates.json`、`probe-queue.json`）。
  - 聚合目录 tldes.com 提供 `/<tld>` 静态三列价表 + `/go/<slug>` 302→官网域，但沙箱现被 Cloudflare 403，不可用作主源。
  - 反爬现状：tld-list.com/namecheap=Cloudflare managed challenge(403)，godaddy=Akamai；clean 优先 SSR 静态表/公开 JSON/简单 XHR，反爬太狠按用户「实用主义」约定标记跳过而非过度投入。
  - 用户本轮指令：扩量两遍都选「两者兼顾/实用主义/大批量」，即先批量覆盖所有可采注册商再按量分级，反爬源限次重试否则跳过。
