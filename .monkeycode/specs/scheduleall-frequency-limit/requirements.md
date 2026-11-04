# Requirements Document — scheduleAll 入队频率限制

## Introduction

采集调度器 `scheduleAll()` 在每次触发时对全部激活注册商入队（队列去重仅跳过 pending/retrying 项），已完成注册商在连续手动触发下被无限重复入队。2026-11-04 生产实证（11 轮全量触发）：priority 10-50 的 34 家注册商循环抓取（120 分钟窗口内 213 个成功任务 / 34 家 ≈ 每家 6.3 次），耗尽每轮 250s drain 预算，priority≥60 的 61 家积压注册商 8 轮全部饿死。

本特性为 `scheduleAll` 增加「近期成功跳过」的入队频率限制：频率窗口内已有成功任务的注册商跳过入队，重复触发聚焦未抓、失败与积压注册商；每日 cron 全量刷新语义保留。

**非目标**：不修改 dequeue 排序规则（`priority ASC, scheduled_at ASC`）、不修改 crawl_queue 表结构、不修改单注册商触发路径。

## Glossary

- **scheduleAll**: `packages/scheduler/index.ts` 的全量入队函数，遍历激活注册商调用 `queue.enqueue`
- **频率窗口**: 判定「近期成功」的时间范围，默认 6 小时，环境变量 `CRAWL_SCHEDULE_WINDOW_HOURS` 可调
- **近期成功**: `crawl_jobs` 表中该注册商 `status='success'` 且完成时间（`finished_at`，回退 `created_at`）落在频率窗口内
- **触发源**: `scheduleAll(trigger)` 参数，取值 `cron` / `api` / `manual`
- **批量入队路径**: `scheduleAll`（cron 路由、/api/v1/crawl 路由）与 `triggerCrawlAll`（`app/actions/admin.ts` 后台「全部采集」按钮）

## Requirements

### Requirement 1: 频率窗口内成功的注册商跳过入队

**User Story:** AS 采集调度器, I want 跳过频率窗口内已成功采集的注册商, so that 重复触发聚焦积压与失败注册商

#### Acceptance Criteria

1. WHEN `scheduleAll` 执行且注册商的最新成功任务完成时间距当前小于频率窗口, THE system SHALL 跳过该注册商入队
2. WHEN 注册商无成功记录或最新成功时间超出频率窗口, THE system SHALL 正常入队
3. WHEN 注册商最新任务为失败或重试状态, THE system SHALL 正常入队（失败注册商每次触发均获得重试机会）
4. WHEN 注册商从未有过采集任务, THE system SHALL 正常入队
5. IF `crawl_jobs` 频率查询失败, THE system SHALL 全量入队并记录警告日志（降级为现有行为，调度不中断）

### Requirement 2: 频率窗口可配置

**User Story:** AS 运维人员, I want 通过环境变量调整频率窗口, so that 不同刷新节奏下无需改代码

#### Acceptance Criteria

1. WHILE 环境变量 `CRAWL_SCHEDULE_WINDOW_HOURS` 设置为合法正整数, THE system SHALL 采用该值作为频率窗口（小时）
2. WHEN 环境变量未设置或解析失败, THE system SHALL 采用默认值 6 小时
3. WHEN 配置值大于等于 24 小时, THE system SHALL 记录警告日志（每日 cron 全量刷新语义受影响）

### Requirement 3: 跳过行为可观测

**User Story:** AS 运维人员, I want 每次全量入队看到跳过数量, so that 验证频率限制生效

#### Acceptance Criteria

1. WHEN `scheduleAll` 完成, THE system SHALL 返回入队数量并在结构化日志中输出 skipped 数量与频率窗口值
2. WHEN 调用方为 cron 路由, THE system SHALL 在 HTTP 响应中携带 `enqueued` 与 `skipped` 计数
3. WHEN 调用方为 /api/v1/crawl 路由, THE system SHALL 在 HTTP 响应中携带 `enqueued` 与 `skipped` 计数

### Requirement 4: 单注册商显式触发保持强制入队

**User Story:** AS 管理员, I want 显式指定单个注册商采集时无视频率窗口, so that 强制补抓随时可执行

#### Acceptance Criteria

1. WHEN 通过 `/api/v1/crawl` 的 `{registrar: slug}` 或后台单家按钮触发, THE system SHALL 直接入队该注册商（该路径不经过 `scheduleAll`，频率限制不适用）
2. WHEN 该注册商已有 pending/retrying 队列项, THE system SHALL 沿用现有去重逻辑返回已有项

### Requirement 5: 后台「全部采集」按钮与 API 全量触发共用频率限制

**User Story:** AS 管理员, I want 后台全部采集按钮与 API 全量触发行为一致, so that 两条批量路径遵循同一频率策略

#### Acceptance Criteria

1. WHEN 管理员点击后台「全部采集」, THE system SHALL 经 `scheduleAll("manual")` 入队（收编现有独立循环）
2. WHEN 频率窗口内有成功记录, THE system SHALL 按 Requirement 1 跳过
3. WHEN 显式单家按钮触发, THE system SHALL 保持 Requirement 4 的强制入队语义

### Requirement 6: 每日 cron 全量刷新语义保留

**User Story:** AS 运维人员, I want 每日定时任务仍覆盖全部注册商, so that 价格数据每日至少刷新一次

#### Acceptance Criteria

1. WHEN cron 触发且频率窗口小于 24 小时, THE system SHALL 在次日 cron 执行时对全部注册商重新入队（窗口外的成功记录不再跳过）
2. WHEN cron 当日 drain 预算未覆盖全部入队项, THE system SHALL 保留 pending 项由后续触发按出队顺序消化
3. WHEN 频率窗口内手动触发跳过某注册商, THE system SHALL 保证该注册商在当日 cron 轮次获得入队机会
