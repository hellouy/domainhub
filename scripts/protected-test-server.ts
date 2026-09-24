/**
 * 受控反爬模拟站 —— 验证采集方法对「cookie + 鉴权头」类站点的可迁移性
 * ------------------------------------------------------------
 * 模拟 hostinger 模式：SPA 页面内的 fetch 需携带会话 cookie + Authorization 头，
 * 缺少任一校验均返回 401。
 *
 * 页面：/protected.html          （页面写入 session cookie 后取价）
 * 接口：/protected-price.json    （校验 authorization 头 + session cookie）
 *
 * 运行：node scripts/protected-test-server.ts（默认端口 8898）
 */
import { createServer } from "node:http"

const PORT = Number(process.env.PORT ?? 8898)

const PRICES = {
  protected: {
    tlds: [
      { tld: "secure.tld", register: 15.5, renew: 18.99, transfer: 15.5 },
      { tld: "vault.tld", register: 12.5, renew: 16.99, transfer: 12.5 },
      { tld: "sentry.tld", register: 8, renew: 10.5, transfer: 8 },
    ],
  },
}

createServer((req, res) => {
  const url = req.url ?? ""
  res.setHeader("Access-Control-Allow-Origin", "*")

  if (url === "/protected.html") {
    res.setHeader("Content-Type", "text/html")
    res.end(`<!doctype html>
<html><head><meta charset="utf-8"><title>Protected Test Page</title></head>
<body><div id="out"></div>
<script>
  document.cookie = "session=abc123; path=/";
  fetch("/protected-price.json", { headers: { Authorization: "Bearer protected-test" } })
    .then((r) => r.json())
    .then((d) => { document.getElementById("out").textContent = JSON.stringify(d); })
    .catch(() => {});
</script></body></html>`)
    return
  }

  if (url === "/protected-price.json") {
    const auth = req.headers["authorization"]
    const cookie = req.headers["cookie"] ?? ""
    if (auth !== "Bearer protected-test" || !cookie.includes("session=")) {
      res.statusCode = 401
      res.setHeader("Content-Type", "application/json")
      res.end(JSON.stringify({ error: { message: "Unauthorized." }, status: 401 }))
      return
    }
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify(PRICES))
    return
  }

  res.statusCode = 404
  res.end("not found")
}).listen(PORT, () => console.log(`protected test server on :${PORT}`))