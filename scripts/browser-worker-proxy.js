/**
 * Local browser-worker proxy —— 本地开发用
 * =========================================
 * SDK 的 playwright 策略读取 BROWSER_SERVICE_URL + BROWSER_SERVICE_TOKEN，
 * 并请求 `${BROWSER_SERVICE_URL}/render`（Bearer 鉴权，返回 {ok, extracted|html}）。
 *
 * 本脚本在指定端口提供同名 `/render` 契约，把请求转发到真实 browser-worker，
 * 便于：
 *   - 本地把 BROWSER_SERVICE_URL 指向本代理（如 http://127.0.0.1:8101），
 *     由本代理统一注入 Authorization，避免每个脚本手动 export token；
 *   - 转发目标既可以是本地 worker（127.0.0.1:8840），也可以是远程 worker。
 *
 * 用法：
 *   WORKER_URL=http://127.0.0.1:8840 \
 *   WORKER_TOKEN=<browser-worker 的 BROWSER_WORKER_TOKEN> \
 *   PORT=8101 node scripts/browser-worker-proxy.js
 *
 * 然后：
 *   BROWSER_SERVICE_URL=http://127.0.0.1:8101
 *   BROWSER_SERVICE_TOKEN=<任意非空，本地代理不校验；下游用 WORKER_TOKEN>
 *
 * 注意：这是浏览器渲染代理，别和聚合反爬服务（CRAWL_SERVICE_URL /api/auto）混淆。
 * 后者只做 direct fetch、不执行 JS，不能满足 cloudns/westcn 等动态渲染页面。
 */
const http = require("http")
const { parse } = require("url")

const TARGET_URL = (process.env.WORKER_URL || "http://127.0.0.1:8840").replace(/\/+$/, "")
const TARGET_TOKEN = process.env.WORKER_TOKEN || ""
const PORT = Number(process.env.PORT || 8101)

const target = new URL(TARGET_URL)

const server = http.createServer((req, res) => {
  const parsedUrl = parse(req.url || "/")

  if (req.method === "GET" && (parsedUrl.pathname === "/health" || parsedUrl.pathname === "/")) {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: true, proxy: true, target: TARGET_URL }))
    return
  }

  const options = {
    hostname: target.hostname,
    port: target.port || (target.protocol === "https:" ? 443 : 80),
    path: parsedUrl.path,
    method: req.method,
    headers: {
      ...req.headers,
      Authorization: `Bearer ${TARGET_TOKEN}`,
      "Content-Type": req.headers["content-type"] || "application/json",
    },
  }
  if (target.protocol === "https:") options.rejectUnauthorized = false

  const transport = target.protocol === "https:" ? require("https") : http
  const proxyReq = transport.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers)
    proxyRes.pipe(res)
  })

  proxyReq.on("error", (err) => {
    console.error("Proxy error:", err.message)
    if (!res.headersSent) res.writeHead(502, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: false, error: err.message, durationMs: 0 }))
  })

  req.pipe(proxyReq)
})

server.listen(PORT, () => {
  console.log(`Browser-worker proxy listening on http://127.0.0.1:${PORT}`)
  console.log(`  -> forwards /render to ${TARGET_URL}/render with Bearer token`)
  console.log(`Set BROWSER_SERVICE_URL=http://127.0.0.1:${PORT}`)
})
