# DomainHub 采集引擎（Crawler Engine）

生产级、可扩展的注册商价格采集框架。所有未来的注册商接入都基于本框架，
新增一个注册商只需要：**创建一个 Adapter 文件 + 注册一行**，无需修改任何其他代码。

## 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                    CrawlerRunner（services/crawler）          │
│        调度 · 重试(3次) · 超时(60s) · 取消 · 统计 · 日志        │
└──────────────┬───────────────────────────────┬──────────────┘
               │ collect()                      │ savePrices()
┌──────────────▼──────────────┐  ┌──────────────▼──────────────┐
│  Adapter（lib/crawler/adapters）│  │  Storage（services/storage）  │
│  initialize → fetch → parse  │  │  差异写入 prices             │
│  → normalize → finish        │  │  追加 price_history          │
│  （继承 BaseAdapter）          │  │  维护 crawl_jobs/crawl_logs  │
└──────────────┬──────────────┘  └─────────────────────────────┘
               │ parse() 委托
┌──────────────▼──────────────┐
│   Parser（services/parser）   │
│   HTML / JSON / XML → 记录    │
└─────────────────────────────┘
```

分层职责（SOLID）：

| 层 | 位置 | 职责 | 禁止 |
| --- | --- | --- | --- |
| Adapter | `lib/crawler/adapters/` | 声明数据在哪、字段怎么映射 | 写解析逻辑、碰数据库 |
| Parser | `services/parser/` | HTML/JSON/XML -> 原始记录 | 了解具体注册商 |
| Storage | `services/storage/` | 全部落库操作 | 发起网络请求 |
| Runner | `services/crawler/` | 调度、重试、超时、取消、统计 | 解析与字段映射 |

依赖注入：`BaseAdapter` 的构造函数接受 `ParserService`，`CrawlerRunner`
的构造函数接受 `StorageService` 与 `RunnerOptions`，均有默认单例，测试时可传入替身。

## Adapter 的工作方式

每个注册商对应一个继承 `BaseAdapter` 的类，生命周期由 Runner 驱动：

| 阶段 | 方法 | 是否必须实现 | 说明 |
| --- | --- | --- | --- |
| 1 | `initialize(ctx)` | 否（默认空） | 校验配置、准备请求参数 |
| 2 | `fetch(ctx)` | **是** | 抓取原始内容，返回 `RawContent`（kind: json/html/xml） |
| 3 | `parse(raw, ctx)` | 否（默认委托 Parser） | 只能通过 `parseOptions()` 调整参数 |
| 4 | `normalize(records, ctx)` | **是** | 原始记录 -> `DomainPrice[]` |
| 5 | `save` | 由 Runner + Storage 执行 | Adapter 永远不直接碰数据库 |
| 6 | `finish(ctx)` | 否（默认空） | 清理资源、汇总日志 |

`collect(ctx)` 是模板方法，按序串联以上阶段，并在每个耗时步骤之间检查取消标记。

### 统一输出格式

每个 Adapter 的 `normalize` 必须精确返回以下结构（`DomainPrice`）：

```ts
{
  registrar: string        // 注册商 slug
  tld: string              // 后缀，不含点
  register_price: number | null
  renew_price: number | null
  transfer_price: number | null
  currency: string         // "USD" / "CNY" ...
  source: string           // 数据来源 URL
  checked_at: Date         // 采集时间
}
```

### 基类内置工具

- `httpGet(url, ctx)` —— 带 60s 超时、3 次重试（指数退避）、取消检查的 HTTP 请求
- `toPrice(v)` —— 任意值 -> 合法价格或 null（拒绝 0/负数/NaN）
- `toTld(v)` —— 清理后缀字符串（去点、小写）

## 如何新增一个注册商

1. 复制 `lib/crawler/adapters/sample.adapter.ts` 为 `<slug>.adapter.ts`
2. 修改 `slug` / `name` / `strategy` 三个字段
3. 实现 `fetch()`：返回 `{ kind, body, sourceUrl }`
4. 实现 `normalize()`：字段映射，用 `toPrice` / `toTld` 校验
5. 在 `lib/crawler/adapters/index.ts` 的 `realAdapters` 数组加一行：

```ts
const realAdapters: RegistrarAdapter[] = [cloudflareAdapter, new PorkbunAdapter()]
```

6. 确认 `registrars` 表中存在该 slug 的记录（后台"注册商"页可管理）

完成。真实 Adapter 会自动覆盖同 slug 的 DemoAdapter，其余代码零改动。

## Runner 的工作方式

`CrawlerRunner`（`services/crawler`）：

- `runBySlug(slug)` —— 运行单个 Adapter：创建 crawl_job（pending -> running），
  调用 `adapter.collect()`，验证后交给 Storage 落库，更新状态与统计
- `runAll()` —— 并发运行全部启用注册商（并发池，**最多 3 个同时运行**）
- `retryFailed()` —— 重试所有"最近一次运行失败/取消"的注册商
- `retryJob(jobId)` —— 对失败/取消的历史任务按其注册商重新运行（trigger 记为 `retry`）
- `stop(jobId)` —— 取消进行中的任务：进程内标记即时生效 + DB 状态标记 `cancelled`
- 重试：每个任务最多 **3 次尝试**，指数退避（1s/2s/4s）
- 超时：单次尝试 **60 秒**，超时计为一次失败
- 失败保护：任何一次成功前的失败都不会写入价格，旧数据完好保留

任务状态机：`pending → running → success | warning | failed | cancelled`

（`warning`：任务完成但存在被验证拒绝的记录，合法记录正常写入。）

## 数据验证（services/validator）

写入前每条 `DomainPrice` 都要通过 `ValidatorService.validate()`，拒绝规则：

| 规则 | 说明 |
| --- | --- |
| 价格非正数 | `register/renew/transfer <= 0` 或 NaN |
| 缺失币种 | `currency` 为空 |
| 缺失注册价 | `register_price` 为 null |
| 重复后缀 | 同一批数据中同一 TLD 出现多次（保留第一条） |
| 非法后缀 | 不符合 `[a-z0-9-.]{1,63}` 或含协议/空格 |

被拒绝的记录：写入 `crawl_logs`（level=warn）、计入 `rows_rejected`、任务标记
`warning`，**不覆盖现有价格**。全部记录都被拒绝时任务直接失败（保护现有数据）。

## 监控字段（crawl_jobs）

每次采集记录：`started_at`、`finished_at`、耗时（由二者推导）、`retries`、
`rows_inserted`、`rows_updated`、`rows_skipped`、`rows_rejected`、`total_tlds`、
`error_message`。

## 调度工作流（Scheduler）

- 后台 `/admin/scheduler`：运行单个 / 全部运行 / 重试失败 / 每日定时开关与运行时刻
- 定时实现：`vercel.json` 配置 Vercel Cron 每小时调用 `GET /api/cron/crawl`；
  该端点检查 `scheduler_settings`（enabled、run_hour_utc、last_run_at），仅当
  启用、到达设定 UTC 时刻且当天未运行时才执行 `runAll("scheduled")`
- 可选保护：设置 `CRON_SECRET` 环境变量后，请求需携带 `Authorization: Bearer <CRON_SECRET>`

## Parser 的工作方式

`ParserService.parse(raw, options)` 按 `raw.kind` 分派：

- **JSON**：对象（map 形态）转为 `[{ key, ...value }]`；数组原样返回
- **HTML**：提取第 `tableIndex` 个 `<table>`，表头行作为字段名
- **XML**：`recordTag` 指定记录元素，子元素为字段

解析失败抛出 `ParseError`，由 Runner 计为一次尝试失败并重试。
复杂文档可在 Parser 内部引入专用解析库替换实现，接口不变，Adapter 无感知。

## Storage 的工作方式

`StorageService`（`services/storage`）是采集结果的唯一落库入口：

- `savePrices(registrarId, items)` —— 先在内存中做全量差异对比，再批量执行：
  - 价格与币种完全一致 → **跳过**（不写 prices，不写 history）
  - 新记录 → 按 200 条一批批量 `INSERT`
  - 有变化 → 10 条并行小批 `UPDATE`
  - 全部变更 → 一次性批量追加 `price_history`
  - 后缀未收录 → 计数返回（在 `tlds` 表添加后自动收录）
- `createJob / markJobRunning / finishJob / cancelJob` —— 任务状态机维护（含监控字段）
- `getLatestFailedRegistrarIds` —— "重试失败"依据
- `getSchedulerSettings / updateSchedulerSettings` —— 每日定时配置
- `writeLog / getJobLogs` —— 采集日志（`crawl_logs`）

## 后台页面

- `/admin/crawler` —— 采集引擎：全部 Adapter 列表、当前状态、运行单个/全部、
  停止、重试、上次运行时间、耗时、更新行数、错误信息
- `/admin/health` —— 健康检查：数据库连通性、采集器状态（卡死任务检测）、
  Adapter 覆盖情况、最近一次采集、24 小时失败任务明细
- `/admin/crawls` —— 历史任务列表与逐条日志
- `/admin/data-quality` —— 数据质量中心：Adapter 健康统计、覆盖率、缺失/非法/重复价格、逐注册商质量明细
- `/admin/scheduler` —— 调度中心：手动运行、重试失败、每日定时开关、运行历史与平均耗时
- `/admin/intelligence` —— 价格情报：最便宜/最贵注册商、平台均价、今日变动、涨跌 Top

## 公开 REST API

| 端点 | 说明 | 参数 |
| --- | --- | --- |
| `GET /api/prices` | 全部价格 | `tld` / `registrar` / `sort`(register\|renew\|transfer\|updated\|tld) / `order` / `page` / `limit`(≤100) |
| `GET /api/prices/{tld}` | 单后缀全注册商价格 | `sort`(register\|renew\|transfer) / `order` |
| `GET /api/registrars` | 注册商列表与价格覆盖数 | `all=1` 包含停用 |
| `GET /api/statistics` | 平台统计（均价、最便宜/最贵、涨跌 Top） | 无 |

## 现有 Adapter

| Adapter | 类型 | 说明 |
| --- | --- | --- |
| `CloudflareAdapter` | 真实数据 | cfdomainpricing.com JSON 数据集（400+ 后缀，批发价） |
| `PorkbunAdapter` | 真实数据 | Porkbun 官方定价 API（`api.porkbun.com/api/json/v3/pricing/get`，900+ 后缀，免鉴权） |
| `DynadotAdapter` | 真实数据 | Dynadot TLD 页 Nuxt 载荷内嵌 JSON（800+ 后缀） |
| `DemoAdapter` × 5 | 架构验证 | 种子数据走完整生命周期（Namecheap、GoDaddy、Name.com、Spaceship、阿里云） |
| `SampleAdapter` | 模板 | 未注册，仅作为新增注册商的复制起点 |
