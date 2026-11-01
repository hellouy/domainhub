/**
 * Local proxy that injects x-api-key for the remote crawl service.
 * Run: node scripts/crawl-proxy.js
 * Then BROWSER_SERVICE_URL=http://localhost:8101
 *
 * The crawl service returns {ok:true, data:{html:"...", elapsed:...}}.
 * The SDK browser module expects {data: "<html>"} for extract:"html",
 * or {data: "<json string>"} for extract:"extract-json" with custom script.
 *
 * This proxy restructures the response to match SDK expectations.
 */
const http = require("http")
const { parse } = require("url")

const TARGET_HOST = "43.133.72.184"
const TARGET_PORT = 8100
const API_KEY = "crawl-service-secure-key-2026"

const server = http.createServer((req, res) => {
  const parsedUrl = parse(req.url)

  const options = {
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: parsedUrl.path,
    method: req.method,
    headers: {
      ...req.headers,
      "x-api-key": API_KEY,
      "Content-Type": "application/json",
    },
  }

  const proxyReq = http.request(options, (proxyRes) => {
    let body = ""
    proxyRes.on("data", (chunk) => (body += chunk))
    proxyRes.on("end", () => {
      try {
        const crawlResp = JSON.parse(body)
        if (crawlResp.ok && crawlResp.data && crawlResp.data.html !== undefined) {
          const sdkResp = {
            data: crawlResp.data.html,
            elapsed: crawlResp.data.elapsed,
          }
          res.writeHead(200, { "Content-Type": "application/json" })
          res.end(JSON.stringify(sdkResp))
        } else {
          res.writeHead(proxyRes.statusCode, proxyRes.headers)
          res.end(body)
        }
      } catch {
        res.writeHead(proxyRes.statusCode, proxyRes.headers)
        res.end(body)
      }
    })
  })

  proxyReq.on("error", (err) => {
    console.error("Proxy error:", err.message)
    res.writeHead(502)
    res.end(JSON.stringify({ ok: false, error: err.message }))
  })

  req.pipe(proxyReq)
})

server.listen(8101, () => {
  console.log("Crawl proxy listening on http://localhost:8101")
  console.log("  -> forwards to http://43.133.72.184:8100 with x-api-key injected")
  console.log("  -> restructures {ok:true,data:{html,...}} -> {data:html}")
  console.log('Set BROWSER_SERVICE_URL=http://localhost:8101 in your environment')
})
