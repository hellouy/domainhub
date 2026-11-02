# 服务拓扑与职责

本文件是各服务的唯一目录：**谁、部署在哪、端口/协议/鉴权、如何探活、由谁管理**。
新增或迁移服务时先改这里，再改代码。

## 一、本地开发服务（当前沙箱）

| 服务 | 端口 | 契约 | 探活 | 管理 |
|------|------|------|------|------|
| app（Next.js） | 3000 | 页面 + `/api/*` | `GET /` | `scripts/services.sh app` |
| browser-worker | 8840 | `POST /render` + Bearer；`GET /health` | `GET /health` | `scripts/services.sh worker` |
| local-sync 调度 | 无端口 | 每 24h 跑一次全量补采 | `logs/local-sync.log` | `scripts/services.sh sync` |

统一入口：

```bash
scripts/services.sh status
scripts/services.sh health
scripts/services.sh start worker
scripts/services.sh logs worker 100
```

## 二、远程服务器 43.133.72.184

| 服务 | 端口 | 契约 | 说明 |
|------|------|------|------|
| crawl-service（聚合反爬） | 8100 | `POST /api/auto`，Header `x-api-key` | 仅 direct fetch，**不执行 JS** |
| cache 服务 | 8090 | HTTP | 缓存 |
| loopia 价格 API | 8000 | `GET /v1/prices?registrar=loopia` | Loopia 适配器直采 |
| 8840 / 8841 / 8842 / 8101 / 8102 | — | TCP 可连但 HTTP 被防火墙丢弃 | 当前无可用服务 |

> 该主机上**没有**公网可达的 browser-worker。Vercel 生产要跑 playwright 策略，
> 需另找带 Chromium 的主机部署 browser-worker（见第四节）。

## 三、外部 SaaS

| 服务 | 地址 | 鉴权 | 用途 |
|------|------|------|------|
| SearXNG | `https://paqu.china.tn/search?format=json` | `Authorization: Bearer` | 促销码发现 |
| Parse.bot | `https://api.parse.bot/scraper/.../list_tld_prices` | `X-API-Key` | Namecheap 全量价格 |
| 远端 Playwright 农场 | `wss://pachong.china.tn` | `Authorization: Bearer` | 2026-10-20 起不可用，停用 |

## 四、服务契约（勿混淆）

### browser-worker（渲染服务）

```
POST /render   Authorization: Bearer <BROWSER_WORKER_TOKEN>
body: { url, extract?, waitFor?, waitForTimeoutMs?, scrollToBottom?, locale?,
        headers?, script?, captureXhrFilter?, apiFetch? }
resp: { ok, finalUrl, title, durationMs, extracted? | html? | xhrResponses? | api?, error? }

GET /health → { ok, chromiumAvailable, activeTasks, concurrency }
```

- 真实 Chromium 渲染，支持 `script`（`page.evaluate`）与 `extract: "extract-json"`。
- 启动必须 `npm start`（`node --experimental-strip-types src/server.ts`），不能用 tsx。

### crawl-service（聚合反爬）

```
POST /api/auto   Header: x-api-key: <CRAWL_SERVICE_TOKEN>
body: { url, timeout?, keyword?, scrollBottom? }
resp: { ok, data: { url, slug, level, html, htmlLength, elapsed } }
```

- 仅 direct fetch；`level` 恒为 `direct`；忽略 `script` / `extract` 参数。
- 适合绕过 Cloudflare/WAF 的静态页，无法采集 AJAX 注入的价格表。

### 环境变量 → 服务映射

| 变量 | 使用方 | 目标 |
|------|--------|------|
| `BROWSER_SERVICE_URL` / `BROWSER_SERVICE_TOKEN` | SDK playwright 策略 | `${URL}/render` |
| `BROWSER_WORKER_URL` / `BROWSER_WORKER_TOKEN` | 站内代理 `app/api/browser` | `${URL}/render` |
| `CRAWL_SERVICE_URL` / `CRAWL_SERVICE_TOKEN` | SDK antiBot 策略 | `${URL}/api/auto` |
| `SEARXNG_BASE_URL` / `SEARXNG_TOKEN` | 促销码采集 | SearXNG |
| `PARSE_BOT_API_KEY` | Namecheap 适配器 | Parse.bot |
| `REMOTE_PLAYWRIGHT_URL` / `REMOTE_PLAYWRIGHT_TOKEN` | browser-worker（可选） | 远端 Playwright 农场 |

## 五、Vercel 生产部署要点

- Vercel serverless 无法运行 Playwright，`BROWSER_SERVICE_URL` 指向站内代理
  `https://<域名>/api/browser`，由 `app/api/browser/render` 透传到
  `${BROWSER_WORKER_URL}/render`。
- 因此生产必须另有一台公网可达、能运行 Chromium 的主机部署 browser-worker。
- 代理未配置 `BROWSER_WORKER_URL/TOKEN` 时返回 503，不影响其它 HTTP 采集。

## 六、常见误配

- 把 `BROWSER_SERVICE_URL` 指向 crawl-service（8100）：协议不同（Bearer vs x-api-key），
  且该服务不渲染 JS，playwright 策略会全部失败。
- 用 tsx 启动 browser-worker：`page.evaluate` 报 `__name is not defined`。
- 同一端口启多个 worker：先 `scripts/services.sh stop worker` 再重启。
