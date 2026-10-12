#!/bin/bash
# 本地每日自动补采 —— 全量注册商(playwright 生产无法采集, 本地补齐)
# 1. 确保本地 browser-worker(8840, 远端 playwright) 存活
# 2. 对所有激活注册商执行写库采集(playwright 走远端 worker, 其余直连)
# 3. 追加日志到 logs/local-sync.log
set -euo pipefail
cd "$(dirname "$0")/.."

export DATABASE_URL=$(grep "^DATABASE_URL=" .env.local | head -1 | cut -d= -f2- | tr -d '"')
export BROWSER_SERVICE_URL="http://127.0.0.1:8840"
export BROWSER_SERVICE_TOKEN="dev-local-remote-pw-worker-token-0123456789abcdef"
export SEARXNG_BASE_URL=$(grep "^SEARXNG_BASE_URL=" .env.local | head -1 | cut -d= -f2- | tr -d '"')
export SEARXNG_TOKEN=$(grep "^SEARXNG_TOKEN=" .env.local | head -1 | cut -d= -f2- | tr -d '"')
export CRAWL_SERVICE_URL=$(grep "^CRAWL_SERVICE_URL=" .env.local | head -1 | cut -d= -f2- | tr -d '"')
export CRAWL_SERVICE_TOKEN=$(grep "^CRAWL_SERVICE_TOKEN=" .env.local | head -1 | cut -d= -f2- | tr -d '"')

LOG=logs/local-sync.log
mkdir -p logs
echo "==== $(date '+%F %T') 开始本地补采 ====" >> "$LOG"

# 确保 worker 存活且渲染可用(8840 = 远端 playwright): 无监听/渲染失败则重启
render_ok() {
  curl -sf http://127.0.0.1:8840/health >/dev/null 2>&1 || return 1
  local out
  out=$(curl -sf -m 45 -X POST http://127.0.0.1:8840/render \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $BROWSER_SERVICE_TOKEN" \
    -d '{"url":"https://example.com","extract":"html","scrollToBottom":true,"waitForTimeoutMs":3000}' 2>/dev/null) || return 1
  echo "$out" | grep -q '"ok":true' || return 1
  return 0
}
if ! render_ok; then
  echo "worker 未存活或渲染失败, 重启 browser-worker(8840, 远端 playwright)" >> "$LOG"
  nohup sh -c 'cd browser-worker && REMOTE_PLAYWRIGHT_URL="wss://pachong.china.tn" REMOTE_PLAYWRIGHT_TOKEN="b79b8155af569e66f29afd077a669ea89956aed95a22a89b" BROWSER_WORKER_TOKEN="dev-local-remote-pw-worker-token-0123456789abcdef" NODE_TLS_REJECT_UNAUTHORIZED=0 npm start' >> "$LOG" 2>&1 &
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
