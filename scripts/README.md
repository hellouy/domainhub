# scripts 目录说明

脚本按用途分组。**核心运维脚本保留在 `scripts/` 根目录**（文档与流程大量引用其路径，
移动会断链）；一次性/探索性脚本放 `scripts/tmp-audit/`、`scripts/archive/`（均 gitignore）。

## 统一入口

| 脚本 | 用途 |
|------|------|
| `services.sh` | 本地三服务统一管理：`start/stop/restart/status/health/logs [app\|worker\|sync\|all]` |

服务职责与端口见 `docs/services.md`。

## 采集与日常运维（根目录）

| 脚本 | 用途 |
|------|------|
| `local-sync.sh` | 每日全量补采一轮（worker 自愈 → 全量 → 兜底 → 促销码） |
| `local-sync-scheduler.sh` | 每 24h 调用 `local-sync.sh` 的循环 |
| `recrawl-browser-registrars.ts` | 按注册商补采（`--all` 全量，或指定 slug） |
| `bulk-recrawl.ts` | 批量重采 |
| `collect-promo-codes.ts` | SearXNG 发现 + 渲染提取促销码并落库 |
| `export-prices.ts` | 采集明细导出到 `data/prices-*.json` |
| `auto-sync-prices.ts` | 自动同步价格 |
| `refresh-rates.ts` | 刷新汇率 |
| `list-stale-slugs.ts` | 打印过期（>7 天）注册商 slug |
| `registrar-status.ts` | 注册商采集状态 |

## 建库 / 种子 / 同步

`setup-db.ts`、`setup-backfill-db.ts`、`setup-platform-db.ts`、`seed.ts`、
`generate-seed-data.ts`、`sync-registrars.ts`、`sync-new-gtlds.ts`、`migrate-deals.ts`。

## 适配器开发与测试

| 脚本 | 用途 |
|------|------|
| `test-adapter.ts` | 8 类标准测试（`<slug>` 写库，`--no-db` 干跑） |
| `check-capabilities.ts`、`set-capabilities*.ts` | 能力位校验/设置 |
| `protected-test-server.ts` | 本地受控反爬模拟站（:8898） |
| `browser-capture/`、`import-capture.ts` | 浏览器抓包与导入 |

## 诊断与审计

- `scripts/tmp-audit/`：一次性审计脚本（gitignore），如 `check-dup.ts`、`parse-vs-db.ts`。
- `scripts/archive/`：已归档的一次性 diag/tmp 脚本（gitignore），保留备查。

## 代理工具

| 脚本 | 用途 |
|------|------|
| `browser-worker-proxy.js` | 本地 `/render` 代理，统一注入 Bearer；worker 在远端或需隐藏 token 时使用。本地直连 8840 时不需要。 |
