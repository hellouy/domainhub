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
- Context: Discovered by Agent while debugging browser-worker 渲染失败 + 实现 api-fetch 采集形态
- Category: Troubleshooting & Debugging
- Instructions:
  - browser-worker 必须用 `node --experimental-strip-types src/server.ts` 启动（package.json start 已如此配置），不能用 tsx：tsx 宿主下浏览器端 page.evaluate 抛 `__name is not defined`，全部 /render 失败。改代码后需重启该后台终端才生效；同一 PORT 只能有一个实例，重启前先 background_terminal_kill 旧实例避免 EADDRINUSE。
  - node strip-types 不识别 `@/` 别名的脚本需用相对路径 import；SDK 侧干跑适配器用 tsx 即可（无 page.evaluate）。
  - Playwright 1.49 的 BrowserContext 没有 `context.request` API，用 `page.evaluate` 内原生 fetch 重放接口（自动带会话 cookie、保持同源特征）；hostinger 定价接口 `POST /api-proxy/api/domain/tlds-pricing` 需 `authorization: Bearer www.hostinger.com` 头 + 会话 cookie，body 显式 `tlds` 数组可一批全量取价。

[Project Knowledge Summary]
- Date: 2026-09-26
- Context: Discovered by Agent while 从 Neon 切 Supabase + Vercel CLI/REST 发布生产
- Category: Operations & Deployment
- Instructions:
  - Supabase Supavisor 池化端点（`*.pooler.supabase.com`，自签证书链）须 `?uselibpqcompat=true&sslmode=require`，否则报 `SELF_SIGNED_CERT_IN_CHAIN`。
  - 页面查询层（safeQuery / withFallback）DB 故障时静默兜底回 seed，页面仍 200；判断"线上真连库"看 `/api/v1/statistics` 的 tldCount/priceCount/lastUpdated 是否来自 DB（seed 29 家/2608 后缀/11755 条 vs DB 29/2610/11708）。
  - 修改 Vercel 环境变量不会自动重部署，须再执行一次部署；CLI 发布需 `vercel link`（写 .env* 与 .vercel 到 .gitignore、拉 env 到 .env.local）。
  - REST 部署：POST `https://api.vercel.com/v13/deployments?teamId=8839029-5124&force=true`，body `{"name":"domainhub","target":"production","gitSource":{"type":"github","repoId":1299004490,"org":"hellouy","ref":"main"}}`（repoId 必须用真实的 1299004490）；用 `GET /v13/deployments/{id}?teamId=8839029-5124` 轮询 readyState 至 READY。target=production 自动挂 www.tldbi.com，验证 `/api/v1/statistics` 未回退 seed。
  - 生产域名 `www.tldbi.com` 绑定项目 `domainhub`（账号 8839029-5124）；部署保护开启，验证 API 用 `vercel curl` 或直接公网 curl。

[Project Knowledge Summary]
- Date: 2026-09-25
- Context: Discovered by Agent while fixing Vercel build ERR_PNPM_LOCKFILE_CONFIG_MISMATCH
- Category: Build Methods
- Instructions:
  - Vercel 用 pnpm@10.x 构建（package.json 钉 packageManager: pnpm@10.34.5）；改 pnpm.overrides 后必须 `pnpm install --no-frozen-lockfile` 重新生成 lockfile 并提交，否则冻结安装报 ERR_PNPM_LOCKFILE_CONFIG_MISMATCH。
  - 本地 corepack pnpm 损坏修复：`corepack disable && npm i -g pnpm@10`；pnpm-workspace.yaml 的 allowBuilds 取值为布尔（esbuild: true / msw: false / sharp: true）。
  - 本地验证部署前先 `pnpm install --frozen-lockfile` 再 `pnpm run build`。

[Project Knowledge Summary]
- Date: 2026-09-28
- Context: Discovered by Agent while 注册商广度扩展到 100+ 家
- Category: Operations & Deployment
- Instructions:
  - 批量新增注册商完整链路：export-prices（ONLY_SLUGS 指定集，后台重采必须显式传 `BROWSER_SERVICE_URL=http://127.0.0.1:8840`，否则依赖浏览器降级的源 FAIL）→ 合并闪断失败源（export 单家闪断不代表结构坏，从上一版 `data/prices-*.json` 合并携带防回归，DB upsert 无 delete 不清缺失行）→ generate-seed-data → bulk-load-new.cjs 入库 → tsc+next build → commit+push → Vercel REST 部署 → 验证 /api/v1/statistics。
  - 数据准确性排查：核对 `/api/v1/prices?tld=<ccTLD>` 新注册商首行真实值对照 sourceUrl；防 unicode 报价、cheap 列无条件价格、负数/0、列错位；明显脏数据从适配器注册表移除 + DB is_active=false，不靠 seed 掩盖。
  - 扩量主杠杆是批发/API 价源（一源数百 TLD）；凭证齐全前并行广度扫描干净 SSR 表格/公开 JSON/simple XHR，命中标准：无登录、无 Cloudflare、结构稳定。反爬太狠按「实用主义」限次重试否则跳过，不过度投入。
  - 扩展探测方法论：ICANN 认证清单（icann.org SPA 但 SSR 首屏可 curl）+ IANA CSV（4505 行，CSV 带引号含逗号须自写 parseCSV）；候选域试本地化路径（/domain-fiyatlari、/price 日语等），首页外链深挖亦有效；解析优先行级 `data-*` 属性/类名（`data-suffix`/`i.create`），比裸 td 顺序稳健；复合后缀正则须 `(?:\.label)+`。
  - **多级后缀坑**：activedomains 旧正则 `[a-z0-9-]*` 不含点号把 com.ru 截断成 com 污染根后缀——新增解析器务必核对多级后缀。
  - **queryStatistics 隐蔽 bug**：raw sql 模板插值列对象产生未限定 `ON "id"="registrar_id"`（prices/registrars 都有 id）报 ambiguous，withFallback 吞错回退 seed 显示陈旧统计。排查 withFallback 类接口须本地直连 DB 跑函数，不能只看线上 200。
  - **is_active 陷阱**：registrars.is_active=false 即使 prices 有数据也被 `/api/v1/registrars` 过滤不进前端；修复适配器写库后必须显式 `update registrars set is_active=true where slug=...`；sync-registrars 的 onConflictDoNothing 不改已有行 is_active。

[User Instruction Summary]
- Date: 2026-09-28
- Context: 用户要求继续扩量到 100+ 家，同时对现有已接入数据做准确性排查，确保无误
- Instructions:
  - 扩量优先打通批发/API 价源作为主杠杆；并行广度扫描各洲干净 SSR 表格/公开 JSON/simple XHR 注册商
  - 数据排查维度：对照 sourceUrl 原始站点三列逐家抽查；校验 @ 首年促销价 vs 常规价不误标；防 unicode 报价、cheap 列无条件价格、负数/0、列错位；脏数据从适配器注册表移除 + DB is_active=false
  - 每轮改动（新增适配器/数据修复）都要 tsc+build 通过并部署到 Vercel 生产后再汇报，保留提交日志 traceability

[User Instruction Summary]
- Date: 2026-09-29
- Context: 用户要求「后台适配所有需 API 的注册商，后期填 Key 即自动生效采集」
- Instructions:
  - 需 API 的注册商（godaddy/namecheap/netim/gandi/infomaniak/enom/resellerclub）后台预置骨架适配器，is_active=false 就绪，不在前端展示
  - 填 Key 自动生效：createCredential/toggleCredential 激活凭证联动 registrars.is_active=true → scheduleAll 自动入队采集
  - 真实凭据采集走 /api/v1/crawl 或 cron/api/cron/crawl（export-prices 命令行是 null ctx 不接凭据）；API 骨架价格字段名契约已标注"需真实 Key 首采核验微调"

[Project Knowledge Summary]
- Date: 2026-10-07
- Context: Discovered by Agent while 促销数据线 + 表格/渲染适配器批量接入
- Category: Operations & Deployment
- Instructions:
  - 促销存 prices 表 3 列（promotion_price/promo_code/promotion_ends_at，无独立表），仅 createPriceSink.save 运行时爬取路径持久化，seed/import 剥离；storage 防护 promo<register 否则静默置 null；`/api/v1/deals` 过滤 promotion_price not null + is_active + 未过期。
  - 表格适配器解析坑：多值单元格（"$38.50 $44.27"、"£22.99 £1.99"、"169 Kč potom 359"）parsePrice en 口径只取空格前首值、eu/fr 口径会因去空格拼接两数；带空格千分位单值（"3 499"）en 只取到 3。**新增解析器务必逐值核对**。
  - render-table-adapter 支持 firstYearIsPromo（register<renew→promotionPrice=register）；playwright 策略本地测试须传 `BROWSER_SERVICE_URL=http://127.0.0.1:8840`。
  - 0-price 存量适配器多为骨架等凭证（godaddy/namecheap/netim/enom/infomaniak/resellerclub）或 JS 渲染不可采（eurodns/netcup/transip/aruba/onecom/hover/internetbs/loopia/lws/registercom/amen），后者实测 SPA/403 不投入。
  - 已接入分区：ps.kz（KZT 49，JS 渲染须 playwright）、julyname（CNY 616）、59.cn（CNY 107，每 TLD 重复 3 档取最低默认档）、zw.cn（CNY 42）、fabulous（USD 500）、danesco（USD 40）、barbero（EUR 10）、lws（EUR 301）、metaname（NZD 92）、domeneshop（NOK 17）、cndns（CNY 75）、forpsi（EUR 243）、cpi（JPY 13）、active24（CZK 10）、lcn（GBP 15）、PS.kz。
  - DB 现状（2026-10-07）：prices 32912 / tlds 3171 / active 83 / 促销 1731（hostinger424+julyname387+namecom321+gatehills264+rumahweb215+59cn100+gandi8+forpsi8+keliweb4）。

[User Instruction Summary]
- Date: 2026-10-08
- Context: 用户扩量两遍都选「两者兼顾/实用主义/大批量」
- Instructions:
  - 先批量覆盖所有可采注册商再按量分级；反爬源限次重试（同 URL 重试 3-4 次取最大响应体）否则跳过
  - 修促销优先级高：促销价 promotionPrice 需落库，这是价值主线

[Project Knowledge Summary]
- Date: 2026-10-08
- Context: Discovered by Agent while Spaceship 适配器 + 双值单元格促销提取
- Category: Operations & Deployment
- Instructions:
  - Spaceship：直连首页 403（Cloudflare），browser-worker /render 真实 Chrome UA 渲染成功（JS SPA）；定价走内部 BFF `POST /gateway/api/v1/pricing-bff/price/getPrices`（body=currencies:["USD"]+products[{productSlug,plan:{pricingPlanSlug:"regular",period:"P1Y",pricingPlanParams:{transfer:1,sld:"spaceship-query1"}}}]，单请求 ≤65 product，返回 regularPrice 标准 + price 促销）。自定义 extract script 页面上下文分块（60/批）重放，579 TLD 全量 ~24s。已入库 465 行含 18 促销（.com 9.68 vs 10.18），is_active=true。
  - table-adapter 新增 `dualValuePromoColumns` 配置：单元格含"原价 促销价"双值（lws "14.59€ 1.99 €"）时第二个更小值进 promotionPrice。lws 已配置 register 列，落 124 条促销，生产 `/api/v1/deals?registrar=lws` 验证通过。
