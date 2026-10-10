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
- Date: 2026-10-08
- Context: Discovered by Agent while 本轮重爬（juming/onamae/westcn）与促销价落库
- Category: Operations & Deployment
- Instructions:
  - 沙箱内 `*.vercel.app` 被 DNS 污染（解析到 Facebook IP 段，HTTP=000），生产验证必须走 `https://tldbi.com`（裸域，308 重定向须 `curl -sL` 跟随）。
  - 后台终端管道 `cmd | tee log` 输出被缓冲，日志迟迟不出；须 `stdbuf -oL -eL` 双侧行缓冲。
  - `npx tsx -e '<inline>'` 不支持 top-level await import pg，DB 快查脚本落 scripts/*.ts 文件跑。
  - Supabase 偶发 `getaddrinfo ENOTFOUND ...pooler.supabase.com` 为瞬时 DNS 抖动，稍候重试即可，勿当配置错误。
  - browser-worker extract-json 短字段映射只认 tld/register/renew/transfer/promotionPrice/promotion；自定义脚本返回其他键名会被静默丢弃（排查促销价丢失时先查这条链路）。

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
  - **IANA 二轮扩展结论（2026-10-10）**：register4less（ICANN #1082）静态价目表 `register4less.com/info/pricing`，433 行 `<tr><td>TLD(大写,含AB.CA二级)</td><td>描述</td><td>&dollar;XX.XX</td></tr>`，仅注册价 USD，parse 420 行入库（register=USD，无 renew），com/net/org $17.95。适配器因"TLD 不在首列+描述列+空分隔格"用 defineAdapter 自定义解析（参照 interserver），不用 createTableAdapter——table-adapter 价格收集循环遍历原始 cells 而非 normalize 后数组，列错位。
  - **其余候选全部不可采**：uk2/123-reg/ionos/webnic/cosmotown（价格 JS 渲染或搜索 API）、webnames.ca（站点下线 404）、123-reg（94B challenge）、sav.com/register.com（数据中心 IP 被 Cloudflare 拦 525）、namesco（静态表仅 17 行且全是首年促销价、18 个 TLD 全被 DB 重复覆盖）、heartinternet/fasthosts（促销块非价目表）。同类已验证源（namecheap/porkbun/dynadot/spaceship/namesilo）均已接入。
  - **重复覆盖也有价值**：新注册商 420 行中 418 行是已有 TLD 的第二个价格点（增强比价），仅 2 个新增后缀；扩量时优先用 cross-icann-db 反向对照 ICANN 3322 家清单筛未接入零售注册商，但多数是 JS 动态价目表——命中"无登录+无 Cloudflare+结构稳定"的静态表标准才值得写适配器。
  - **探测前必须先核对适配器 slug 列表（2026-10-10 教训）**：本批 ovh（已有 ovhcloud API 适配器 941 行）与 atak（已有 atakdomain 958 行）均因未先查 `grep -n "slug:" adapters/*.ts` 而误做重复适配器。规范：任何新候选写适配器前，先 `grep -rn "slug:" adapters/*.ts` 取 106 个既有 slug，并 `npx tsx scripts/tmp-audit/check-dup.ts`（ilike 查询）核对 DB 别名，避免重名。误做后修复：删文件 + index.ts 移除 + DB `delete prices/registrars` + revert 提交。

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

[Project Knowledge Summary]
- Date: 2026-10-09
- Context: Discovered by Agent while 价格数据完整性审计 + 批量修复适配器
- Category: Troubleshooting & Debugging
- Instructions:
  - 价格完整性审计 SQL：`count(*) filter (where renew_price is null)` 按 registrar slug 分组，快速定位缺续费价的注册商。
  - 本地批量重爬：设 `DATABASE_URL`（生产 Supabase）+ `BROWSER_SERVICE_URL=http://127.0.0.1:8840` + `BROWSER_SERVICE_TOKEN`，调 `runCrawlWithSdk(registrarId, {trigger:"manual"})`，直写生产库；JS 渲染适配器（onamae/exabytes/juming/namesilo/hostingkr/networksolutions）通过 playwright 策略经 browser-worker 渲染后正常解析。
  - test-adapter.ts 用法：`DATABASE_URL=... BROWSER_SERVICE_URL=... BROWSER_SERVICE_TOKEN=... npx tsx scripts/test-adapter.ts <slug> --no-db`；带 browser env 时 playwright 策略自动生效。
  - 源无续费价（不可修复）：vsys/imena/idwebhost/blacknight/exabytes/icdsoft/one/lcn/gzidc（源页面/API 无 renew 列）；mchost 378 行仅 7 有 renew；101domain 252 行仅 30 有 renew（pricing.htm 26 主流 TLD 有全维度，new_gtld_extensions.htm 仅注册价）。
  - 适配器 URL 失效排查：curl 目标站首页后深挖 /domains、/pricing、/pricelist、本地化路径（如 loopia /domannamn/detaljerad_prislista/、aruba /listino-domini.aspx）；403/JS 渲染的用 browser-worker playwright 策略测试。

[Project Knowledge Summary]
- Date: 2026-10-09
- Context: Discovered by Agent while 接入远程 Playwright Server
- Category: Operations & Deployment
- Instructions:
  - 平台提供远程 Playwright Browser Server：`wss://pachong.china.tn`（Bearer token `b79b8155af569e66f29afd077a669ea89956aed95a22a89b`，服务端 playwright 1.62.1 / Chromium 151，自签名证书）。browser-worker 配置 `REMOTE_PLAYWRIGHT_URL=wss://...` + `REMOTE_PLAYWRIGHT_TOKEN=...` 即用 `chromium.connect()` 连远程而非本地 launch，SDK 的 HTTP `/render` 协议不变；远程模式下自动 `NODE_TLS_REJECT_UNAUTHORIZED=0`。
  - playwright `chromium.connect()` 客户端版本必须与服务端精确一致（不匹配返回 428 Precondition Required）；已把 browser-worker 的 playwright 固定为 `1.62.1`。
  - 远程 Playwright 服务器数据中心 IP 会被 Cloudflare 拦截（namesilo 返回 "Just a moment..."），反爬严的站点仍走本地 browser-worker；常规 JS 渲染站点（cosmotown 249 行 26s、aruba 360 行 16s）远程模式验证正常。
  - browser-worker 常驻服务启动必须用 background_terminal 且 `timeout_ms` 设 0，否则会被按超时杀掉。
  - 全量 86 注册商首页促销码探测结论：首页渲染只能发现"首页级促销码"，多数注册商把码藏在独立促销页（`/promos/`、`/coupon_deals.htm`、`/promocodes`、`/promotions-and-free-offers`）。反爬分布：Cloudflare-challenge 拦 namecheap/namecom/onamae/lws/exabytes，captcha 拦 cloudns/westcn/connectreseller/regtons/vsys/cosmotown/lcn/blacknight/easyspace；本地 Chromium 对 Cloudflare 挑战仍无解。首页候选 token（如 osir SAMPLES、gname EXCHANGE、wpx SAVE79）均为页面噪音。
  - **官方促销码采集方法论（替代聚合站）**：① SearXNG `site:<host> promo code OR promos OR deals OR coupons` 定向搜索找到官方促销页 URL（JSON 格式，自签名证书需脚本内 `NODE_TLS_REJECT_UNAUTHORIZED=0`，Bearer 鉴权，单查询 45s 超时+重试，勿加 time_range 否则变慢）；② browser-worker 渲染促销页，提取"use code X" / "Promo code: X" / 大写字码+价格块（`CODE|US$3.60|/年|US$9.66|/年`）。甄别噪音：gandi 的 EXCLUSIONS/FOLLOW/PLEASE、namesilo 的 THAT/WHILE、hostpoint 的 TEST、epik 的 OFFERINGS 均为 FAQ/普通词误报，需人工确认。③ 真实码入库 SQL：TLD 特定码 `UPDATE prices p SET promo_code=$c FROM tlds t WHERE p.tld_id=t.id AND p.registrar_id=$rid AND t.tld=ANY($tlds) AND p.promo_code IS NULL`，通用码去掉 `t.tld=ANY` 映射全部行。同注册商多码仅首码落位（一行一个 promo_code）。成果：with_code 21→919（namecheap NEWCOM679/ENTITLES/BDAYTRANSFER26、dynadot DYNA12、namecom SAVE15/NEWHOME/1006ETE6、spaceship COM67/NET19/XYZ52/IO85/SPSR86、101domain WELCOME/SAVEONDOMAINS、exabytes 1010SALE、networksolutions NSDOMAINS30）。
   - **多码支持（2026-10-10）**：prices/price_history 各加 `promo_codes jsonb` 列（`PromoCodesRow[]`：{code,promotionPrice?:number,promotionEndsAt?:string,sourceUrl?:string}），`promo_code` 保留为主码（数组首码）向后兼容，不建关联表。迁移=ALTER TABLE + 回填现有 promo_code→单元素数组；多码回填用 `promo_codes = promo_codes || jsonb_build_array(...)` + `@>` 防重复。全链路 select 均返回 promoCodes；storage save 时数组优先写 jsonb、首码作主码；admin action 多码输入每行 `CODE[,price[,YYYY-MM-DD][,url]]`，与单码互斥（两者只填一种）。jsonb 经 pg 返回 unknown，查询层必须 cast 成 PromoCodesRow[] 否则 TS 报错；jsonb 数组元素字段是 number（norm 后）而非 numeric string。deals 组件按码渲染多 chip + 独立复制。

[User Instruction Summary]
- Date: 2026-10-10
- Context: IANA 注册商扩展探测 eNom 批发价目表时，用户纠正扫描范围
- Instructions:
  - 不对批发商做扫描（eNom/Tucows/OpenSRS/Key-Systems/Hexonet/1API/InterNetX/Realtime Register/ResellerClub/Synergy Wholesale/PDR 等），只要零售商家的价格
  - 此前「批发/API 价源是主杠杆」的扩量思路（2026-09-28 条目）自此被取代：候选筛选与适配器只针对面向终端用户的零售注册商

[Project Knowledge Summary]
- Date: 2026-10-08
- Context: Discovered by Agent while favicon DB 缓存接入 + 生产权限诊断
- Category: Operations & Deployment
- Instructions:
  - 生产与本地 DB 连接角色不同：本地 `.env.local` 的 DATABASE_URL 是表 owner `tldbi_app`（全权限）；Vercel 生产用 tldbi_POSTGRES_URL（Supabase pooler）以 `postgres` 角色运行，对 registrars 等表**只有 SELECT 无 UPDATE/INSERT**。Vercel 上任何写操作若遇 `permission denied for table X`，用本地连接 `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE X TO postgres` 后即可生效，无需改代码或环境变量。
  - Next.js App Router 下划线前缀目录（如 `api/_diag`）是私有文件夹**不参与路由**，404；诊断路由须用普通命名（如 `api/diag`）。
  - drizzle/pg 查询中 `column === value` 不会生成 WHERE（Column 对象 !== 字符串得 false 被忽略，返回全表 limit 1 错行），必须用 `eq(column, value)`。
  - pg 驱动 bytea 默认返回 Buffer，drizzle customType 的 fromDriver/toDriver 直接透传 Buffer 即可 roundtrip。
