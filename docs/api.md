# REST API v1

> 所有权:Platform Team · 代码:`app/api/v1/`

所有端点为版本化只读 JSON API(除 `/crawl` 外),响应结构 `{ data, meta? }`,错误结构 `{ error }`。保持向后兼容:字段只增不删。

## 端点

### GET /api/v1/prices

价格列表。查询参数:

| 参数 | 说明 |
|---|---|
| `tld` | 按后缀过滤(如 `com`) |
| `registrar` | 按注册商 slug 过滤 |
| `sort` | `register`(默认)/ `renew` / `transfer` |
| `limit` / `offset` | 分页(limit 默认 100,最大 500) |

### GET /api/v1/registrars

注册商列表,含能力(capabilities)、健康快照(health)与推荐分(score)。按推荐分降序排列。参数:`active=true|false`。

推荐分(0-100)加权模型,基于 DB 实有数据:

| 维度 | 权重 | 说明 |
|------|------|------|
| `scoreBreakdown.coverage` | 35% | 支持后缀数,对数刻度,500+ 满分 |
| `scoreBreakdown.promo` | 25% | 促销密度(promotionPrice 非空占比),67%+ 满分 |
| `scoreBreakdown.completeness` | 15% | 注册+续费价齐全的行占比 |
| `scoreBreakdown.capability` | 15% | ICANN 认证/WHOIS 隐私/DNSSEC/支付方式各占 1/4 |
| `scoreBreakdown.health` | 10% | 采集健康分(jsonb health.score),缺失时取中性 0.5 |

响应字段新增:`whoisPrivacy`、`dnssec`、`paymentMethods`、`promoCount`、`completeCount`、`score`、`scoreBreakdown`。

### GET /api/v1/history

价格历史。参数:`tld`(必填)、`registrar`(可选)、`days`(默认 30)。

### GET /api/v1/statistics

平台统计:注册商数、TLD 数、价格行数、最近采集成功率、平均延迟。

### GET /api/v1/health

各适配器健康:score、coverage、successRate、avgLatencyMs、lastSuccessAt、currentStrategy、failureReason。

### GET /api/v1/adapters

代码中注册的适配器清单:slug、版本(adapter/parser/sdk)、策略优先级、owner、能力,合并数据库中的发现元数据。

### POST /api/v1/crawl(需管理员会话)

触发采集。Body:`{ "registrarId": 1 }` 或 `{ "all": true }`(入队所有已迁移的活跃注册商)。响应包含每个注册商的入队/执行结果。

## Cron

`GET /api/cron/crawl` 由 Vercel Cron 每日 03:00 UTC 调用，`GET /api/cron/backfill` 每 5 分钟推进回填一批。两者都要求至少 32 字符的 `CRON_SECRET`，并以恒时比较校验 `Authorization: Bearer ...`；未配置密钥时拒绝请求。5 分钟 Cron 频率需要支持分钟级 Cron 的 Vercel 计划。

## 兼容性承诺

- 已发布字段永不删除、永不改类型
- 新能力以新字段/新端点形式添加
- 破坏性变更必须发布 `/api/v2`,`/api/v1` 保持可用
