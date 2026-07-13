# Registry 平台

> 所有权:Platform Team · 代码:`packages/registry/`

## 注册商注册表(自注册)

每个适配器通过 `registerAdapter(adapter)` 自注册到内存注册表。`adapters/index.ts` 是唯一 import 所有适配器的位置;`services/crawl` 通过 `getRegisteredAdapter(slug)` 查找。

`syncAdapterToDb(adapter)` 在每次成功采集后把适配器元数据同步到数据库:

- `registrars` 表:`adapter_version`、`owner`、`priority`、`health`(健康快照)
- `registrar_capabilities` 表:能力集合(见下)
- `discovery_metadata` 表:发现元数据(见下)

## 能力注册表(registrar_capabilities)

每商一行,JSONB 存储:

```
registration, renewal, transfer, restore, premiumDomains,
dnssec, whoisPrivacy, bulkSearch, nameservers, api,
coupons, affiliate, marketplace,
supportedTldCount, supportedCurrencies, supportedLanguages
```

能力由适配器在 `defineAdapter({ capabilities })` 中声明,采集成功后自动同步。`supportedTldCount` 由实际采集行数自动回填。

## 发现元数据(discovery_metadata)

每商一行:

```
pricingUrl, apiEndpoint, xhrEndpoint, graphqlEndpoint,
detectedStrategy, authRequired, jsRequired, contentType,
lastVerified, fingerprint
```

- `detectedStrategy` 为最近一次成功采集实际使用的策略
- `fingerprint` 是数据源结构 hash,变化说明源结构可能已变更
- `lastVerified` 在每次成功采集后刷新

## 健康快照(registrars.health)

每次采集(无论成败)后由 `services/crawl.refreshHealth()` 基于最近 20 次任务重算:

```
score (0-100), coverage, successRate, failureRate,
avgLatencyMs, lastSuccessAt, lastFailureAt,
failureReason, currentStrategy
```

健康分算法见 `packages/metrics`:成功率(60%权重)+ 覆盖率(30%)+ 延迟(10%)。

## 查询接口

- `listRegisteredAdapters()` —— 代码中注册的所有适配器
- `getRegistryOverview()` —— 注册商 + 能力 + 发现元数据 + 健康的合并视图(`/api/v1/adapters` 使用)
