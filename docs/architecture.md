# DomainHub 平台架构

> 所有权:Platform Team · 最后更新:Sprint 5(平台化)

## 目标

DomainHub 不再只是一个网站,而是全球域名注册商生态的基础设施层:

1. 支撑 100+ 注册商,无需为新注册商增加基础设施
2. 支持多种数据源类型(API / JSON / XHR / HTML / CSV / Playwright 等)
3. 新注册商接入 < 30 分钟(见 `docs/how-to-add-registrar.md`)
4. 业务逻辑与爬虫基础设施分离
5. 每个模块可独立测试
6. 强制向后兼容

## 目录结构

```
app/                      Next.js 页面与 API 路由(仅 UI/HTTP 壳)
  api/v1/                 版本化 REST API
  api/cron/crawl/         每日定时采集入口
  admin/                  后台管理(登录保护)
components/               React 组件(不包含业务逻辑)
packages/                 平台层(可独立测试,不依赖 UI)
  adapter-sdk/            Adapter SDK 2.0(生命周期/策略引擎/校验/限流/代理)
  parser/                 Parser 平台(JSON/HTML/Table/CSV/XML/Hydration/GraphQL)
  storage/                Storage 平台(插入/更新/历史/diff/回滚)
  queue/                  Queue 平台(抽象接口 + 数据库实现)
  metrics/                Metrics 平台(阶段计时/健康分)
  registry/               注册商注册表 + 能力注册表 + 发现元数据
  scheduler/              调度编排(cron 与手动共用)
  credentials/            凭证加密(AES-256-GCM)
services/                 业务服务层(编排 packages,不依赖 UI)
  crawl/                  采集业务流程
  prices/                 价格/统计/历史查询(REST API 复用)
adapters/                 注册商适配器(唯一允许注册商特定逻辑的位置)
lib/                      旧模块(保留,向后兼容)
  crawler/                旧爬虫(runner 已桥接到新 SDK,旧适配器作为回退)
  db/                     Drizzle schema 与连接
scripts/                  数据库迁移 / 种子 / 适配器测试
docs/                     本目录
```

## 分层与依赖规则

```
UI (app/, components/)
  ↓ 只能调用
services/ (业务编排)
  ↓ 只能调用
packages/ (平台能力) + adapters/ (注册商逻辑)
  ↓ 只能调用
lib/db (持久化)
```

- **UI 不包含业务逻辑**;server actions 与 API 路由只做参数解析与鉴权,然后调用 services。
- **packages 不依赖 UI**、不依赖具体队列实现、不包含注册商特定逻辑。
- **注册商特定逻辑只允许出现在 `adapters/`**。任何在 parser、storage、services 中出现 `if (slug === "xxx")` 的代码都是架构违规。
- **队列可替换**:业务只依赖 `packages/queue` 的 `Queue` 接口,当前实现是数据库队列,未来可换 Redis/Upstash/RabbitMQ/SQS。

## 采集数据流

```
调度(cron / 手动 / API)
  → services/crawl.runCrawlWithSdk(registrarId)
    → registry 查找适配器(按 slug 自注册)
    → BaseAdapter.run() 驱动 9 阶段生命周期
       initialize → discover → fetch → parse → validate
       → normalize → compare → save → cleanup
       (fetch/parse 由策略引擎按优先级自动降级)
    → storage 只写有变化的行 + 追加历史
    → metrics 记录各阶段耗时/行数/覆盖率
    → registry 回写发现元数据 + 健康快照
```

## 向后兼容策略

- `lib/crawler/runner.runCrawlJob()` 签名不变;内部优先尝试新 SDK 路径,未迁移的注册商自动回退旧适配器。
- 数据库只做增量迁移(新表、新可空列),旧表旧列永不删除/重命名。
- 旧管理后台、前台页面、server actions 全部不受影响。

## 模块所有权

| 模块 | 所有权 | 文档 |
|---|---|---|
| packages/adapter-sdk | Platform Team | docs/adapter-sdk.md |
| packages/parser | Platform Team | docs/parser.md |
| packages/storage | Platform Team | docs/storage.md |
| packages/queue | Platform Team | docs/architecture.md(本文) |
| packages/registry | Platform Team | docs/registry.md |
| packages/credentials | Platform Team | docs/credentials.md |
| services/* | Platform Team | docs/architecture.md(本文) |
| adapters/* | 各适配器文件头部 `owner` 字段 | docs/how-to-add-registrar.md |
| app/api/v1 | Platform Team | docs/api.md |

## 未来 AI 生成代码的规则

1. 新注册商 = 在 `adapters/` 新增一个 `defineAdapter()` 文件 + 在 `adapters/index.ts` 注册,不允许新增基础设施。
2. 修改平台行为 = 修改 `packages/`,并保证所有适配器测试(`scripts/test-adapter.ts`)仍通过。
3. 任何 schema 变更必须是增量的(新表/新可空列),写入 `scripts/` 迁移脚本。
4. 业务逻辑放 `services/`,UI 层只做壳。
