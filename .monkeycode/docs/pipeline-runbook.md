# TLD 价格采集入库管线 — 操作与迭代说明书

> 用途：下次迭代直接复用。涵盖「采集明细落盘 → 数据库自动灌库 → 演示站 seed 兜底」整条管线，以及全部常驻进程、端口、数据库、已知阻塞与下一步入口。

## 1. 总体架构

```
45 家注册商适配器 (adapters/index.ts)
        │  executeStrategies (SDK 2.0, 自动降级)
        ▼
scripts/export-prices.ts ──▶ data/prices-YYYYMMDD.json   (24 家 / ~1.1 万条明细落盘)
        │
scripts/auto-sync-prices.ts  ◀── 常驻 watcher（每 8s 探测 DATABASE_URL）
        │       探测成功 → 幂等三表灌库
        ▼
Postgres（Neon / Supabase / 本地均可） → registrars / tlds / prices / crawl_jobs
        ▲
lib/db/queries.ts (safeQuery) ── DB 不可用时可无缝演示
        ▲
lib/db/seed-fallbacks.ts ◀── 种子兜底（原程序无 DB 仍完整渲染）
        │
next dev (端口 3000) = 演示站（原程序本体，非静态快照）
```

## 2. 环境与前置

### 2.1 后台常驻终端清单（重启会话后必须重建）

| 用途 | 命令 | 端口 |
|---|---|---|
| 浏览器 worker（playwright 渲染，采集依赖） | `cd /workspace/browser-worker && PORT=8840 npm start` | 8840 |
| 原程序 dev server（演示站） | `cd /workspace && npm run dev` | 3000 |
| 数据库灌库 watcher | `cd /workspace && npx tsx scripts/auto-sync-prices.ts` | — |

- 全部用 `background_terminal_create` 启动，不能用 `&`。
- worker 并发 **= 2**，并发 > 2 会 502/超时。
- **浏览器 worker 首次启动前置**（沙箱/新机器必做）：`cd browser-worker && npm install`，然后 `npx playwright install chromium`，再 `npx playwright install-deps chromium`（apt 装 `libglib-2.0`/`libnss3`/`libatk` 等动态库，装完需 `ldconfig`）。全部完成后才 `npm start`，否则 playwright 策略报 `SELF_SIGNED_CONNECT` 或直接 `browserType.launch` 失败。chromium 无浏览器服务时，仅 html/api 策略可跑（采集得 15 家）；配好后 playwright 策略恢复（可到 25 家+）。

### 2.2 数据库连接（2026-09-26 起：Supabase）

- 现用数据库：**Supabase** 项目 `tiwxkcoqxxrmwlovaixs`（region `ap-northeast-1`），库 `postgres`。
- 应用专用角色 `tldbi_app`（由管理 API SQL 创建并授权；密码存于 `/workspace/.env.local` 与 Vercel 生产环境变量，不入库）。
- 连接串（本地与 Vercel 同一形式，仅密钥来源不同）：
  - 池化端点 `aws-0-ap-northeast-1.pooler.supabase.com:6543`，参数 **`uselibpqcompat=true&sslmode=require`**
  - 本地取自 `/workspace/.env.local`（受 gitignore 保护）；Vercel 取自 Production 环境变量 `DATABASE_URL`
  - 必须带 `uselibpqcompat=true`：`pg` v8.22 起把 `sslmode=require` 当 `verify-full` 处理，而 Supavisor 池化端点用自签证书链，会报 `SELF_SIGNED_CERT_IN_CHAIN` 并被 safeQuery 静默兜底回 seed 数据（页面仍 200，只是不是真数据）
- Vercel 项目里仍保留旧的 Neon 集成变量（`POSTGRES_URL`、`DATABASE_URL_UNPOOLED`、`tldbi_*` 等），应用只读 `DATABASE_URL`，故已失效但无害；Neon 免费层配额耗尽，已被 Supabase 取代。
- 表结构由 `scripts/setup-db.ts` 建（已与 `lib/db/schema.ts` 全量对齐：含 Sprint 5 新表/新列），数据由 `npx tsx scripts/auto-sync-prices.ts` 幂等灌入。
- **全量灌库提速**：watcher 逐行 upsert 在池化链路下仅约 1-7 行/秒且长连接易被断开；1 万+ 条建议改批量多值 INSERT（每批 400 条，`ON CONFLICT (registrar_id,tld_id) DO UPDATE`，语义与 watcher 一致）。
- **换库**：改 `.env.local` 与 Vercel `DATABASE_URL` 即可，代码零改动。

## 3. 采集明细导出

```bash
cd /workspace && BROWSER_SERVICE_URL=http://127.0.0.1:8840 npx tsx scripts/export-prices.ts
```

- 对全部已注册适配器逐家执行策略链，成功者做轻量标准化（tld 去点小写、`parsePriceString` 转数字、currency 缺省取 definition.currency）。
- 输出：`data/prices-YYYYMMDD.json`，结构：
  ```json
  { "collectedAt": "...", "registrars": {
      "cloudflare": { "name": "...", "website": "...", "currency": "USD", "strategy": "...",
                      "prices": [ { "tld": "com", "currency": "USD", "registerPrice": 9.77, "renewPrice": 9.77, "transferPrice": 9.77 } ] } } }
  ```
- 同名日期文件每次运行覆盖写。
- **兜底快照刷新**：`npx tsx scripts/generate-seed-data.ts` 把最新导出转成 `lib/crawler/seed-prices.ts`（24 家 / ~1.17 万条内嵌模块），重建后无 DB 环境（Vercel 预览/演示站）即展示全量采集数据；`lib/crawler/seed-data.ts` 将其与 5 家品牌占位注册商（namecheap/godaddy/dynadot/spaceship/aliyun）合并，快照优先。

### 最近一次导出（2026-08-30）

24 家 / 11,708 条：cloudflare 427 / porkbun 907 / ovhcloud 942 / gandi 42 / namecom 590 / namesilo 471 / onamae 443 / infomaniak 20 / hostpoint 1165 / xserver 255 / value-domain 467 / muumuu-domain 417 / hostinger 105 / cloudns 1218 / 22cn 98 / westcn 118 / openprovider 2069 / directnic 534 / dreamhost 319 / forpsi 229 / juming 126 / blacknight 157 / truehost 577 / hostingkr 12。

## 4. 数据库自动灌库 watcher

```bash
cd /workspace && npx tsx scripts/auto-sync-prices.ts
```

- 流程：读 `data/` 最新明细 → 循环探测（每 8s `SELECT 1`，连接超时 12s）→ 数据库可用后自动灌库 → 写 `data/sync-meta.json` 退出。
- **幂等语义**：registrars/tlds 仅补缺失（`ON CONFLICT DO NOTHING`，品牌既有记录不触碰）；prices 按 `(registrar_id, tld_id)` `DO UPDATE` 刷新；crawl_jobs 追加一条 `trigger=manual` 完成记录。
- 自动加载 `.env.local`（`process.loadEnvFile`）。
- 任何 Postgres 系数据库通用，无需改代码。

## 5. 演示站 = 原程序本体

- 启动：`cd /workspace && npm run dev`（Next.js 16，端口 3000），预览地址通过 `request_preview {port:3000}` 获取。
- **查询兜底机制**：`lib/db/queries.ts` 的 `safeQuery` 在 DB 不可用时回退到 `lib/db/seed-fallbacks.ts`（由 `SEED_PRICES` 在 `lib/crawler/seed-data.ts` 构造 8 家品牌注册商 + 全部 TLD 最低价 + 各注册商价格明细，返回类型与 DB 行完全对齐）。**DB 恢复后自动切真实数据**，seed 只在 DB 不可用时生效。
- `next.config.mjs` 已配 `allowedDevOrigins: [".monkeycode-ai.online"]` 使预览子域可访问。
- 改代码后重启 dev server（`background_terminal_kill` + 重建）。

## 6. 已知阻塞与候选

| 项 | 状态 | 备注 |
|---|---|---|
| Neon 计算配额耗尽 | 已解决（换库） | 2026-09-26 起改用 Supabase（见 §2.2），24 家 / 11,708 条已灌入 |
| dynadot | 反爬 | Cloudflare challenge 劫持接口返回 HTML 非 JSON，暂停 |
| godaddy / namecheap / netim | 需凭证 | private-api 需 API 凭证，待配置后启用 |
| 101domain | 间歇 | Cloudflare 间歇 challenge，本轮未收录（先前 PASS 263 条）；重跑 export 可补 |
| one.com / exabytes / networksolutions 等 | 低 ROI | React 网格 + 懒加载，表格解析为空，暂不落地 |
| worker 并发上限 | 约束 | 并发=2，全量导出约 8 分钟 |

## 7. 下次迭代入口

1. 复核线上/演示站数据源：Supabase 已灌 24 家（DB 模式下 priceCount=11708、jobCount=1），无 DB 时自动回落 seed 快照（priceCount=11755）。
2. 补齐漏采：重跑 `scripts/export-prices.ts`（101domain 等间歇站会自动补录），或为 dynadot 迭代 api-fetch/浏览器策略；重采后跑 `scripts/generate-seed-data.ts` 刷新兜底快照。
3. 需要再换库时：改 `.env.local` 与 Vercel `DATABASE_URL`（见 §2.2）。
4. 扩展候选注册商时沿用「SSR 全量价格表站点优先」判断（xserver/value-domain/muumuu 型最稳定）。

## 8. 关键文件索引

| 文件 | 作用 |
|---|---|
| `scripts/export-prices.ts` | 采集明细落盘导出 |
| `scripts/auto-sync-prices.ts` | 数据库恢复后自动灌库 watcher |
| `data/prices-<date>.json` / `data/sync-meta.json` | 落盘明细 / 同步状态 |
| `lib/db/queries.ts` | safeQuery 兜底（DB 不可用回退 seed） |
| `lib/db/seed-fallbacks.ts` | 种子兜底视图（与 DB 行同构） |
| `lib/crawler/seed-data.ts` | SEED_PRICES / SEED_SOURCE_URLS 种子源 |
| `next.config.mjs` | allowedDevOrigins 预览配置 |
| `.env.local` | DATABASE_URL（含 Neon 连接串，gitignore 保护） |
| `adapters/index.ts` / `adapters/table-registrars.ts` | 45 家注册商注册入口与配置 |
| `.monkeycode/MEMORY.md` | 行为级项目知识（worker 启动方式、反爬等） |