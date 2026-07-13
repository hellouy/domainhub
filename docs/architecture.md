# DomainHub 架构文档

> Sprint 4 平台化改造后的系统全景。采集器相关细节见 [crawler.md](./crawler.md)。

## 系统分层

```
┌─────────────────────────────────────────────────────────┐
│  展示层                                                   │
│  app/(public)/*     前台页面（首页/后缀/注册商/比价）        │
│  app/admin/*        后台管理（9 个页面，密码保护）           │
│  app/api-docs       Swagger UI（公开 API 文档）            │
├─────────────────────────────────────────────────────────┤
│  API 层                                                  │
│  app/api/v1/*       版本化公开 REST API（统一处理层包裹）    │
│  app/api/prices 等  旧路径 → v1 转发（向后兼容）            │
│  app/api/cron/*     Vercel Cron 定时入口                  │
│  lib/api/handler.ts 统一处理层（限流/请求ID/指标/安全头）    │
│  lib/api/openapi.ts OpenAPI 3.0 规范（单一事实来源）        │
├─────────────────────────────────────────────────────────┤
│  服务层（services/*，全部 server-only 单例）                │
│  crawler    采集编排：任务生命周期/并发池/重试/取消          │
│  validator  写入前数据验证（非法价格/重复/缺失字段）          │
│  storage    数据访问：差异对比批量写入/任务状态机/调度设置    │
│  parser     通用解析工具（JSON/HTML 表格/CSV）              │
│  coverage   覆盖率矩阵与注册商健康分                        │
│  cache      进程内 TTL 缓存 + 标签失效（全站唯一缓存入口）   │
│  metrics    性能指标采集与聚合查询                          │
│  audit      管理操作审计日志                               │
├─────────────────────────────────────────────────────────┤
│  采集层（lib/crawler/*）                                   │
│  registry.ts        RegistrarRegistry：Adapter 注册中心    │
│  adapters/base.adapter.ts  抽象基类（HTTP/重试/超时/退避）  │
│  adapters/*.ts      各注册商 Adapter（3 真实 + 5 演示）     │
├─────────────────────────────────────────────────────────┤
│  数据层                                                   │
│  lib/db/schema.ts   Drizzle Schema（10 张表）              │
│  lib/db/queries.ts  前台查询   lib/db/admin-queries.ts 后台 │
│  Neon Postgres      唯一持久化存储                         │
└─────────────────────────────────────────────────────────┘
```

## 数据流

### 采集写入流

```
Adapter.collect()（fetch → parse → normalize）
  → ValidatorService.validate()（拒绝非法记录，全拒则任务失败）
  → StorageService.savePrices()（内存差异对比 → 批量 INSERT/UPDATE + price_history）
  → finishJob()（状态机 + 监控字段）
  → MetricsService.record()（耗时指标）
  → CacheService.invalidateTag()（prices/statistics/coverage 缓存失效）
```

### API 读取流

```
GET /api/v1/prices?tld=com
  → createApiHandler（请求ID → 限流检查 → 计时开始）
  → CacheService.getOrSet("api:...", 60s)
  → lib/db 查询（未命中缓存时）
  → NextResponse（X-Request-Id / X-RateLimit-Remaining / 安全头）
  → metrics 记录 api.response_time
```

## 数据库表（10 张）

| 表 | 用途 |
| --- | --- |
| `registrars` | 注册商主数据（slug 唯一，isActive 控制采集与展示） |
| `tlds` | 后缀主数据（tld 唯一，type/isPopular） |
| `prices` | 当前价格（registrar_id + tld_id 唯一） |
| `price_history` | 价格变更历史（仅有变化时追加；(tld_id, recorded_at) 索引） |
| `crawl_jobs` | 采集任务（状态机 + retries/rows_* 监控字段） |
| `crawl_logs` | 任务日志（level: info/warn/error） |
| `scheduler_settings` | 每日定时配置（单行：enabled/run_hour_utc/last_run_at） |
| `metrics` | 性能指标（(name, recorded_at) 索引） |
| `audit_logs` | 管理操作审计（不可变追加） |

## 公开 API（v1）

| 端点 | 缓存 | 说明 |
| --- | --- | --- |
| `GET /api/v1/prices` | 60s | 价格列表（tld/registrar 筛选，排序分页） |
| `GET /api/v1/prices/{tld}` | 60s | 单后缀全注册商价格 |
| `GET /api/v1/history/{tld}` | 10min | 按天聚合的价格历史（range=7d/30d/90d/1y，可选 registrar） |
| `GET /api/v1/registrars` | 60s | 注册商列表与覆盖数 |
| `GET /api/v1/statistics` | 10min | 平台统计（均价/最便宜/涨跌 Top） |
| `GET /api/v1/openapi.json` | - | OpenAPI 3.0 规范 |

所有 v1 响应携带 `X-Request-Id`；限流 120 req/min/IP，超限 429 + `Retry-After`。
旧路径（`/api/prices` 等）转发到 v1 处理器，行为一致。

## 缓存策略

| 层 | TTL | 失效时机 |
| --- | --- | --- |
| 公开 API 响应 | 60s | 采集成功且有更新 → `invalidateTag("prices")` |
| 统计/覆盖率/历史 | 10min | 同上（statistics/coverage 标签） |
| 监控面板 | 30s | 时间自然过期 |

进程内缓存（Serverless 每实例独立）。替换为 Redis 时只改 `services/cache`，调用方零改动。

## 安全

- **后台**：`ADMIN_PASSWORD` 环境变量 + HttpOnly Cookie 会话；所有 Server Action 先 `requireAdmin()`
- **限流**：公开 API 120 req/min/IP（滑动窗口，进程内）
- **审计**：登录成功/失败、采集触发/停止、调度变更、注册商编辑均写入 `audit_logs`，监控中心可查
- **响应头**：`X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、`Referrer-Policy`
- **Cron**：设置 `CRON_SECRET` 后 `/api/cron/crawl` 要求 `Authorization: Bearer <secret>`
- **SQL**：全部经 Drizzle 参数化查询，无字符串拼接

## 后台页面（9 个）

概览 / 注册商 / 采集任务 / 采集引擎 / 健康检查 / 数据质量 / 调度中心 / 价格情报 / 覆盖率 / 监控

## 扩展指南

**新增注册商**：`lib/crawler/adapters/` 新建 `<slug>.ts` 继承 `BaseAdapter` →
在 `adapters/index.ts` 的 `realAdapters` 注册 → `registrars` 表加记录。详见 crawler.md。

**新增 API 端点**：`app/api/v1/<name>/route.ts` 用 `createApiHandler("<name>", ...)` 包裹 →
`lib/api/openapi.ts` 补充 paths 定义（Swagger 自动更新）。

**替换缓存后端**：仅改 `services/cache/index.ts` 内部实现，保持 `getOrSet/invalidateTag` 签名。
