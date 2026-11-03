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

**统一入口网关 `:8200`**（2026-11-03 上线）：平台所有外部采集调用走网关，
鉴权为 `Authorization: Bearer <统一入口密钥>`（环境变量 `CRAWL_SERVICE_TOKEN`）。
网关内部自动携带各通道密钥转发，外部调用方只需入口密钥：

| 通道 | 内部端口 | 网关路径 |
|------|----------|----------|
| browser（渲染聚合） | 8090 | `/v1/browser/*`（schema 与本平台 `/render` 不同，SDK 未接入） |
| crawl（聚合反爬） | 8100 | `POST /v1/crawl/auto` |
| registrar（价格聚合） | 8000 | `GET /v1/registrar/prices?registrar=<slug>` |
| search（SearXNG） | 8080 | `GET /v1/search?q=<kw>&format=json` |

> 该主机部署了 **browser-worker 舰队**：`8840/8841/8842/8843` 为同构 `/render` 实例
> （`BROWSER_WORKER_TOKEN` 同值），`8085` 为备选渲染实例；`9222` 是 Chromium CDP 调试端口
> （ws://，非 HTTP `/render` 端点，供 worker `REMOTE_PLAYWRIGHT_URL` 复用远程 Chromium）。
> `8090` 是网关内部的渲染聚合通道（schema 与本平台 `/render` 不同，SDK 未接入）。
> 注意：沙箱出口 IP 被该主机防火墙丢弃（TCP 可连、HTTP 挂起），联通性须在宿主机
> 安全组确认放行（Vercel 函数出口亦然）。

## 三、外部 SaaS

| 服务 | 地址 | 鉴权 | 用途 |
|------|------|------|------|
| SearXNG | `https://paqu.china.tn/search?format=json` | 经网关 `/v1/search` 代携 Bearer | 促销码发现 |
| Parse.bot | `https://api.parse.bot/scraper/.../list_tld_prices` | `X-API-Key` | Namecheap 全量价格 |
| 远端 Playwright 农场 | `wss://pachong.china.tn` | `Authorization: Bearer` | 2026-10-20 起不可用，停用 |

## 四、服务契约（勿混淆）

### 统一入口网关（:8200）

```
GET  /health                                  免鉴权
GET  /v1/status                               四通道健康（browser/crawl/registrar/search）
POST /v1/crawl/auto      Authorization: Bearer <入口密钥>
     body: { url, keyword }
     resp: { ok, data: { url, slug, level, html, htmlLength, elapsed } }
GET  /v1/registrar/prices?registrar=<slug>   Authorization: Bearer <入口密钥>
     resp: { ok, data: { rows: [{ registrar, tld, register_price, renew_price,
                                   transfer_price, currency, updated_at }] } }
GET  /v1/search?q=<kw>&format=json           Authorization: Bearer <入口密钥>
```

- `/v1/crawl/auto` 聚合反爬：仅 direct fetch，不执行 JS；`level` 恒为 `direct`。
- SDK antiBot 策略（`strategy-engine.ts`）、`collect-promo-codes.ts`、Loopia 适配器均已切到网关。
- Loopia 通道实测约 47 个 TLD，SEK，数据新鲜（`updated_at` 每日更新）。

### browser-worker（渲染服务，本地 :8840）

```
POST /render   Authorization: Bearer <BROWSER_WORKER_TOKEN>
body: { url, extract?, waitFor?, waitForTimeoutMs?, scrollToBottom?, locale?,
        headers?, script?, captureXhrFilter?, apiFetch? }
resp: { ok, finalUrl, title, durationMs, extracted? | html? | xhrResponses? | api?, error? }

GET /health → { ok, chromiumAvailable, activeTasks, concurrency }
```

- 真实 Chromium 渲染，支持 `script`（`page.evaluate`）与 `extract: "extract-json"`。
- 启动必须 `npm start`（`node --experimental-strip-types src/server.ts`），不能用 tsx。
- **舰队模式**：`BROWSER_SERVICE_URL` 支持逗号分隔多地址（如 `http://h:8840,http://h:8841`）。
  SDK `packages/adapter-sdk/browser-service.ts` 客户端自动 `GET /health` 探活（4s 超时，
  正/负结果缓存 30s/60s）、轮询选取实例；渲染遇传输错误/超时/HTTP 402/502/503/504
  自动切换下一实例，400/401 直接抛错。内部基建调用一律走全局 fetch，
  不经适配器站点限流链（`rateLimitedFetch` 会覆盖调用方 signal 并把探测拖到 60s）。

### crawl-service（聚合反爬，内部 :8100）

```
POST /api/auto   Header: x-api-key: <内部通道密钥>
body: { url, timeout?, keyword?, scrollBottom? }
resp: { ok, data: { url, slug, level, html, htmlLength, elapsed } }
```

- 仅 direct fetch；`level` 恒为 `direct`；忽略 `script` / `extract` 参数。
- 外部调用方一律走网关 `/v1/crawl/auto`，由网关代携内部 `x-api-key`。

### 环境变量 → 服务映射

| 变量 | 使用方 | 目标 |
|------|--------|------|
| `CRAWL_SERVICE_URL` / `CRAWL_SERVICE_TOKEN` | SDK antiBot 策略、collect-promo、Loopia 适配器 | 网关 `:8200`（`/v1/crawl/auto`、`/v1/registrar/prices`、`/v1/search`） |
| `BROWSER_SERVICE_URL` / `BROWSER_SERVICE_TOKEN` | SDK playwright 策略 | `${URL}/render`（本地 worker） |
| `BROWSER_WORKER_URL` / `BROWSER_WORKER_TOKEN` | 站内代理 `app/api/browser` | `${URL}/render` |
| `SEARXNG_BASE_URL` / `SEARXNG_TOKEN` | 促销码采集（经网关 `/v1/search`） | SearXNG |
| `PARSE_BOT_API_KEY` | Namecheap 适配器 | Parse.bot |
| `REMOTE_PLAYWRIGHT_URL` / `REMOTE_PLAYWRIGHT_TOKEN` | browser-worker（可选） | 远端 Playwright 农场 |

> `LOOPIA_API_KEY` 已废弃（2026-11-03 凭证轮换后直连 :8000 返 401），
> Loopia 改走网关 registrar 通道，复用统一入口密钥。

## 五、Vercel 生产部署要点

- Vercel serverless 无法运行 Playwright，生产 `BROWSER_SERVICE_URL` 配置为远程
  browser-worker 舰队（逗号分隔，2026-11-03 起）：
  `http://43.133.72.184:8840,http://43.133.72.184:8841,http://43.133.72.184:8842,http://43.133.72.184:8843,http://43.133.72.184:8085`
  SDK 自动健康检查 + 失败转移：单实例卡死或端口防火墙丢包时，采集切换到下一实例。
  `BROWSER_SERVICE_TOKEN` 与各远程 worker 的 `BROWSER_WORKER_TOKEN` 同值。
- `9222` 是 Chromium CDP 调试端口（ws://），不是 `/render` HTTP 端点，不列入舰队；
  供 worker 以 `REMOTE_PLAYWRIGHT_URL` 复用远程 Chromium。
- 备选方案：`BROWSER_SERVICE_URL` 指向站内代理 `https://<域名>/api/browser`，
  由 `app/api/browser/render` 透传到 `${BROWSER_WORKER_URL}/render`；
  代理未配置 `BROWSER_WORKER_URL/TOKEN` 时返回 503，不影响其它 HTTP 采集。
- 前提：远程主机 8840-8843/8085 须对 Vercel 函数出口 IP 开放（沙箱出口已被防火墙丢弃，
  TCP 可连、HTTP 挂起；worker 卡死时同样表现为 HTTP 挂起，需在宿主机重启）。
- 生产 env 已配置（2026-11-03）：`BROWSER_SERVICE_URL`（舰队）、`BROWSER_SERVICE_TOKEN`、
  `PARSE_BOT_API_KEY`、`CRAWL_SERVICE_URL=http://43.133.72.184:8200`、`CRAWL_SERVICE_TOKEN`、
  `AI_GATEWAY_API_KEY`、`BROWSER_WORKER_URL=http://43.133.72.184:8840`、`BROWSER_WORKER_TOKEN`。
  `SEARXNG_BASE_URL/TOKEN` 仅促销码采集脚本使用（远程主机 crontab 运行），无需配到 Vercel。

## 六、常见误配

- 把 `BROWSER_SERVICE_URL` 指向 crawl-service（8100）或网关 `/v1/crawl/auto`：
  契约不同（`/render` vs Bearer JSON），playwright 策略会全部失败。
- 用 tsx 启动 browser-worker：`page.evaluate` 报 `__name is not defined`。
- 同一端口启多个 worker：先 `scripts/services.sh stop worker` 再重启。
- Loopia 适配器残留旧 `LOOPIA_API_KEY` 直连 :8000：凭证已轮换，必 401；统一走网关。
