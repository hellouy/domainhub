#!/bin/bash
# 本地每日自动补采 —— 全量注册商(playwright 生产无法采集, 本地补齐)
# 1. 确保本地 browser-worker(8840) 存活(默认本地 chromium; 可选远端 playwright)
# 2. 对所有激活注册商执行写库采集(playwright 走本地 worker, 其余直连)
# 3. 追加日志到 logs/local-sync.log
#
# 所有密钥统一从 .env.local 读取, 不在脚本内硬编码。
set -euo pipefail
cd "$(dirname "$0")/.."

# 读取 .env.local 中 KEY 的值(去首尾引号, 保留值内 = 号)
envval() { grep -E "^$1=" .env.local 2>/dev/null | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || true; }

export DATABASE_URL="$(envval DATABASE_URL)"
export BROWSER_SERVICE_URL="$(envval BROWSER_SERVICE_URL)"; export BROWSER_SERVICE_URL="${BROWSER_SERVICE_URL:-http://127.0.0.1:8840}"
export BROWSER_SERVICE_TOKEN="$(envval BROWSER_SERVICE_TOKEN)"
export SEARXNG_BASE_URL="$(envval SEARXNG_BASE_URL)"
export SEARXNG_TOKEN="$(envval SEARXNG_TOKEN)"
export CRAWL_SERVICE_URL="$(envval CRAWL_SERVICE_URL)"
export CRAWL_SERVICE_TOKEN="$(envval CRAWL_SERVICE_TOKEN)"
export PARSE_BOT_API_KEY="$(envval PARSE_BOT_API_KEY)"
export LOOPIA_API_KEY="$(envval LOOPIA_API_KEY)"
# 可选: 配置了远端 playwright 农场则透传给 worker; 留空使用本地 chromium
export REMOTE_PLAYWRIGHT_URL="$(envval REMOTE_PLAYWRIGHT_URL)"
export REMOTE_PLAYWRIGHT_TOKEN="$(envval REMOTE_PLAYWRIGHT_TOKEN)"

if [ -z "${BROWSER_SERVICE_TOKEN:-}" ]; then
  echo "错误: .env.local 缺少 BROWSER_SERVICE_TOKEN, 无法启动/鉴权 browser-worker" >&2
  exit 1
fi

LOG=logs/local-sync.log
mkdir -p logs
echo "==== $(date '+%F %T') 开始本地补采 ====" >> "$LOG"

# 确保 worker 存活且渲染可用: 无监听/渲染失败则重启
render_ok() {
  curl -sf "$BROWSER_SERVICE_URL/health" >/dev/null 2>&1 || return 1
  local out
  out=$(curl -sf -m 45 -X POST "$BROWSER_SERVICE_URL/render" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $BROWSER_SERVICE_TOKEN" \
    -d '{"url":"https://example.com","extract":"html","scrollToBottom":true,"waitForTimeoutMs":3000}' 2>/dev/null) || return 1
  echo "$out" | grep -q '"ok":true' || return 1
  return 0
}
if ! render_ok; then
  echo "worker 未存活或渲染失败, 重启 browser-worker(8840)" >> "$LOG"
  # 本地 chromium 模式(默认)；若 .env.local 配了 REMOTE_PLAYWRIGHT_URL 则连远端农场
  export BROWSER_WORKER_TOKEN="$BROWSER_SERVICE_TOKEN"
  export PORT=8840
  if [ -n "${REMOTE_PLAYWRIGHT_URL:-}" ]; then
    export NODE_TLS_REJECT_UNAUTHORIZED=0
  fi
  nohup sh -c 'cd browser-worker && npm start' >> "$LOG" 2>&1 &
  for i in $(seq 1 20); do
    render_ok && break
    sleep 1
  done
fi

# 恢复卡死 running 队列项(serverless 崩溃残留, 生产 cron 无法自愈)
echo "--- 恢复卡死 running 队列项 ---" >> "$LOG"
npx tsx -e "import { recoverStaleRunning } from '@/packages/scheduler'; recoverStaleRunning(30*60*1000).then(n => console.log('恢复:', n)).catch(e => console.error(e.message))" >> "$LOG" 2>&1 || true

# 全量采集: 所有激活注册商(playwright + 直连), 每轮 95 家约 60-120 分钟; timeout 防挂起阻塞调度循环
timeout 21600 npx tsx scripts/recrawl-browser-registrars.ts --all >> "$LOG" 2>&1 || echo "补采失败: $?" >> "$LOG"

# 兜底补采: 全量轮之后仍有过期(>7 天)的注册商(某轮采集静默失败等), 立即定向重试
STALE_SLUGS=$(npx tsx scripts/list-stale-slugs.ts 2>/dev/null | tail -1 || true)
if [ -n "$STALE_SLUGS" ]; then
  echo "--- 兜底补采过期注册商: $STALE_SLUGS ---" >> "$LOG"
  timeout 3600 npx tsx scripts/recrawl-browser-registrars.ts $STALE_SLUGS >> "$LOG" 2>&1 || echo "兜底补采失败: $?" >> "$LOG"
fi

# 促销码采集: SearXNG 发现官方促销页 + 远端 playwright 渲染提取, 全量补采后执行
echo "--- 促销码采集(SearXNG) ---" >> "$LOG"
timeout 3600 npx tsx scripts/collect-promo-codes.ts >> "$LOG" 2>&1 || echo "促销码采集失败: $?" >> "$LOG"
echo "==== $(date '+%F %T') 补采结束 ====" >> "$LOG"
