# 数据库可移植性（Neon / Supabase / 通用 Postgres）

本项目的连接层（`lib/db/index.ts`）供应商无关：同一套代码可在 **Neon**、**Supabase**、
**自建/通用 Postgres** 之间切换，**仅靠环境变量**，无需改动任何业务代码或 schema。

三家都是标准 Postgres（over TCP + SSL），统一用 `node-postgres`（`pg`）驱动通吃。

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | Postgres 连接串（Neon/Supabase/自建均可） |
| `DB_DRIVER` | 否 | 目前仅 `pg`（默认）。保留字段以便将来扩展 |
| `DB_SSL` | 否 | `require`（默认，非本地强制 SSL）\| `disable`（本地无 SSL 时用） |
| `DB_POOL_MAX` | 否 | 连接池上限，serverless 建议较小，默认 `5` |

## 各供应商连接串

### Neon（当前生产）
```
postgresql://<user>:<password>@<endpoint>.neon.tech/<db>?sslmode=require
```
- 生产库 endpoint：`ep-holy-river-ah7m2nn3`
- serverless 环境推荐使用 Neon 的 **pooled** 连接串（带 `-pooler` 后缀的 host）

### Supabase
Supabase 提供两种连接：
- **Session/直连**（端口 5432）：`postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres`
- **Transaction Pooler**（端口 6543，serverless 推荐）：
  ```
  postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
  ```
- Supabase 强制 SSL，保持 `DB_SSL=require`（默认即可）。
- 使用 Transaction Pooler 时连接池 `DB_POOL_MAX` 设小（如 `3~5`）。

### 通用 / 自建 Postgres
```
postgresql://<user>:<password>@<host>:5432/<db>
```
- 本地无 SSL 时设 `DB_SSL=disable`。

## 切换步骤（不改代码）

1. 在目标库执行 schema 迁移（见 `scripts/setup-*.ts`，或用 `pg_dump`/`pg_restore` 迁移全量）。
2. 校验目标库与源库**逐表行数一致**（务必，见下）。
3. 更新环境变量 `DATABASE_URL` 指向新库。
4. 重新部署，验证读写正常。
5. 源库**保留一段时间**（建议 ≥7 天）作为回滚后备，确认无误后再下线。

## 安全红线（生产迁移）

- 迁移前后**逐表行数必须一致**，任一表不一致就**中止切换**。
- 全程**不删除源库**（Neon 保留作回滚）。
- 切换 `DATABASE_URL` 属不可逆的生产操作，需在有人值守时执行。

## 诊断

- `detectDbProvider()` / `dbProvider`（`lib/db`）返回当前连接的供应商（neon/supabase/postgres），
  仅用于日志与后台展示，不影响连接行为。
