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

### 2.2 数据库连接

- 连接串位于 `/workspace/.env.local`（`DATABASE_URL=...`，受 gitignore 保护，不入库）。
- 当前指向共享 Neon（`POSTGRES_URL` 池化连接串）；Neon 免费层**计算时长配额已耗尽**（连接被拒 `quota exceeded`），数据库可达但拒绝连接，数据未丢失。
- **换库**：改 `.env.local` 的 `DATABASE_URL` 指向 Supabase/本地 PG/恢复后的 Neon 即可，watcher 与演示站零改动。

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
| Neon 计算配额耗尽 | 阻塞（数据未丢） | 恢复/升级后 watcher 自动灌库，演示站自动切真实数据 |
| dynadot | 反爬 | Cloudflare challenge 劫持接口返回 HTML 非 JSON，暂停 |
| godaddy / namecheap / netim | 需凭证 | private-api 需 API 凭证，待配置后启用 |
| 101domain | 间歇 | Cloudflare 间歇 challenge，本轮未收录（先前 PASS 263 条）；重跑 export 可补 |
| one.com / exabytes / networksolutions 等 | 低 ROI | React 网格 + 懒加载，表格解析为空，暂不落地 |
| worker 并发上限 | 约束 | 并发=2，全量导出约 8 分钟 |

## 7. 下次迭代入口

1. 复核 `data/sync-meta.json` 与 term 日志 —— 确认 Neon 恢复后自动灌库成功、演示站展示真实数据。
2. 补齐漏采：重跑 `scripts/export-prices.ts`（101domain 等间歇站会自动补录），或为 dynadot 迭代 api-fetch/浏览器策略。
3. 视配额情况换库：改 `.env.local` 的 `DATABASE_URL` 指向 Supabase/本地 PG 后验证管线。
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